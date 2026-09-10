import { execFileSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the original demo intact so rebuilding never concatenates an already combined reel
const sources = {
  wordmark: resolve(process.env.GLYPH_MEDIA ?? resolve(homedir(), 'Downloads'), 'glyph3.mov'),
  demo: fileURLToPath(new URL('../public/initiatives/glyph.mp4', import.meta.url)),
  cubes: resolve(process.env.GLYPH_MEDIA ?? resolve(homedir(), 'Downloads'), 'glyph2.mov'),
};
// Intercut the wordmark, typography features, and interactive labels
const shots = [
  ['wordmark', 0, 3],
  ['cubes', 0.5, 4],
  ['demo', 4, 8],
  ['cubes', 8, 11],
  ['demo', 23, 26],
  ['wordmark', 5, 7],
  ['cubes', 14, 17],
  ['demo', 31, 34],
  ['cubes', 20, 23],
  ['demo', 52, 56],
  ['wordmark', 13, 15],
];
const output = fileURLToPath(new URL('../public/initiatives/glyph-reel.mp4', import.meta.url));
// Fit each capture inside the portal's center square without stretching or cropping text
const filters = shots.map(
  ([, from, to], index) =>
    `[${index}:v]scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30,trim=end_frame=${Math.round((to - from) * 30)},setsar=1,format=yuv420p[v${index}]`
);

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...shots.flatMap(([source, from, to]) => [
      '-ss',
      String(from),
      '-t',
      String(to - from),
      '-i',
      sources[source],
    ]),
    '-filter_complex',
    `${filters.join(';')};${shots.map((_, index) => `[v${index}]`).join('')}concat=n=${shots.length}:v=1:a=0[out]`,
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
console.log(`Wrote ${output} (${shots.reduce((total, [, from, to]) => total + to - from, 0)}s)`);
