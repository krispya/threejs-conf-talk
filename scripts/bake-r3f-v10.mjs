import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cut the React Three Fiber v10 portal loop from the workshop promo captures. The shots
// follow the Remotion edit in ../minecraft-like/promo/src/cues.ts, grouped as website hero,
// product configurator, then voxel game. A demo montage closes with one more hard cut.
const media = process.env.PROMO_MEDIA ?? '/Users/krisbaumgartner/Dev/minecraft-like/promo/media';
const output = fileURLToPath(new URL('../public/initiatives/r3f-v10.mp4', import.meta.url));

// The workshop reel is 2048x1556 with its content letterboxed, so each source names the
// 16:9 window past the bars. The captures are wider than 16:9 and only lose a little height.
const sources = {
  hero: { file: 'track_promo.mp4', crop: '1984:1116:32:220' },
  reel: { file: 'track_promo.mp4', crop: '2048:1152:0:202' },
  game: { file: 'minecraft-like.mov', crop: '2758:1551:0:36' },
  watch: { file: 'faraz_watch.mov', crop: '2540:1428:0:111' },
  demos: {
    file:
      process.env.R3F_V10_RECORDING ??
      '/Users/krisbaumgartner/Desktop/Screen Recording 2026-08-28 at 11.55.01 AM.mov',
    crop: '1822:1588:0:0',
  },
};

// Source seconds, in playback order
const shots = [
  ['hero', 5.56, 6.5],
  ['hero', 10.32, 12.4],
  ['reel', 7.66, 8.82],
  ['watch', 1, 4.33],
  ['reel', 15.4, 16.25],
  ['game', 1, 4.07],
  ['hero', 12.4, 15.12],
  ['game', 10, 12.39],
  // Twenty seconds of demos with loading pauses trimmed out
  ['demos', 0, 4.4],
  ['demos', 4.9, 10.3],
  ['demos', 11.9, 12.9],
  ['demos', 15.4, 16.9],
  ['demos', 17.4, 19.4],
  ['demos', 19.9, 21.9],
  ['demos', 22.3, 23.1],
  ['demos', 28.7, 31.6],
];

const inputs = shots.flatMap(([source, from, to]) => [
  '-ss',
  String(from),
  '-to',
  String(to),
  '-i',
  resolve(media, sources[source].file),
]);
const filters = shots
  .map(
    ([source, from, to], index) =>
      `[${index}:v]crop=${sources[source].crop},scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30${source === 'demos' ? `,trim=end_frame=${Math.round((to - from) * 30)}` : ''},setsar=1,format=yuv420p[v${index}]`
  )
  .join(';');
const concat = shots.map((_, index) => `[v${index}]`).join('');

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    `${filters};${concat}concat=n=${shots.length}:v=1:a=0[out]`,
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'slow',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ],
  { stdio: 'inherit' }
);
console.log(
  `Wrote ${output} (${shots.reduce((total, [, from, to]) => total + to - from, 0).toFixed(2)}s)`
);
