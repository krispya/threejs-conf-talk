import { execFileSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Intercut liquid controls, floral UI, and animated glass panels
const shots = [
  ['design1.mp4', 1],
  ['design2.mp4', 4],
  ['design3.mp4', 0],
  ['design1.mp4', 9],
  ['design2.mp4', 14],
  ['design1.mp4', 18],
  ['design2.mp4', 20],
  ['design3.mp4', 10],
];
const output = fileURLToPath(new URL('../public/initiatives/design-system.mp4', import.meta.url));
// Each shot lasts 75 frames for a 20-second loop at 30 fps
const filters = shots.map(
  (_, index) =>
    `[${index}:v]scale=720:720:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30,trim=end_frame=75,setsar=1,format=yuv420p[v${index}]`
);

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...shots.flatMap(([source, from]) => [
      '-ss',
      String(from),
      '-t',
      '2.5',
      '-i',
      resolve(process.env.DESIGN_SYSTEM_MEDIA ?? resolve(homedir(), 'Downloads'), source),
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
console.log(`Wrote ${output} (20s)`);
