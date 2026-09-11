import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const media =
  process.env.GAMES_MEDIA ?? fileURLToPath(new URL('../reference/games', import.meta.url));
const output = fileURLToPath(new URL('../public/initiatives/games.mp4', import.meta.url));
// Crop recording borders and browser controls before fitting the portal's center square
const shots = [
  { file: 'boiler-room', post: '2075454607237820797', from: 0.5, to: 6.5, crop: '1152:648:36:36' },
  { file: 'crashcat', post: '2021906714686280052', from: 2, to: 10, crop: '1188:560:24:90' },
  { file: 'navcat', post: '1988012661884555729', from: 7, to: 15, crop: '1046:652:34:34' },
  { file: 'wizard', post: '2027394705194119447', from: 1, to: 9, crop: '992:636:246:54' },
];

mkdirSync(media, { recursive: true });
for (const shot of shots) {
  const source = resolve(media, `${shot.file}.mp4`);
  if (existsSync(source)) continue;
  execFileSync(
    'yt-dlp',
    [
      '--no-update',
      '--no-progress',
      '-f',
      'best[ext=mp4][protocol=https]/best[ext=mp4]',
      '-o',
      source,
      `https://x.com/isaac_mason_/status/${shot.post}`,
    ],
    { stdio: 'inherit' }
  );
}

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...shots.flatMap(({ file, from, to }) => [
      '-ss',
      String(from),
      '-t',
      String(to - from),
      '-i',
      resolve(media, `${file}.mp4`),
    ]),
    '-filter_complex',
    shots
      .map(
        ({ crop, from, to }, index) =>
          `[${index}:v]crop=${crop},scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30,trim=end_frame=${Math.round((to - from) * 30)},setsar=1,format=yuv420p[v${index}]`
      )
      .join(';') +
      `;${shots.map((_, index) => `[v${index}]`).join('')}concat=n=${shots.length}:v=1:a=0[out]`,
    '-map',
    '[out]',
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '18',
    '-preset',
    'slow',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    `${output}.tmp.mp4`,
  ],
  { stdio: 'inherit' }
);
renameSync(`${output}.tmp.mp4`, output);
console.log(`Wrote ${output} (${shots.reduce((total, { from, to }) => total + to - from, 0)}s)`);
