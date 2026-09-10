import { execFileSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../public/initiatives/mathzamples.mp4', import.meta.url));

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    process.env.MATH_RECORDING ?? resolve(homedir(), 'Downloads/mathzamples.mp4'),
    '-vf',
    // Remove the sidebar and browser toolbar, then fit the demo inside the portal's center square
    'crop=2732:1992:724:90,scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1,format=yuv420p',
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
