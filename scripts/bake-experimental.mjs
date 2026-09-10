import { execFileSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../public/initiatives/experimental.mp4', import.meta.url));
const sources = ['klipp1.mp4', 'kilpp2.mp4'].map((file) =>
  resolve(process.env.EXPERIMENTAL_MEDIA ?? resolve(homedir(), 'Downloads'), file)
);

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...sources.flatMap((source) => ['-i', source]),
    '-filter_complex',
    // Fit both recordings inside the portal's center square before joining them
    sources
      .map(
        (_, index) =>
          `[${index}:v]scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30,setsar=1,format=yuv420p[v${index}]`
      )
      .join(';') + ';[v0][v1]concat=n=2:v=1:a=0[out]',
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
console.log(`Wrote ${output}`);
