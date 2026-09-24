import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Alishan Forest Railway cabin moving uphill, by BayTsai, CC0
// https://freesound.org/people/BayTsai/sounds/860228/
const source = fileURLToPath(
  new URL('../node_modules/.cache/sound/alishan-cabin.mp3', import.meta.url)
);
const output = fileURLToPath(new URL('../public/sounds/cabin.mp3', import.meta.url));
const rate = 48000;
// A stretch without voices or birdsong. The rumble loads the loop between the margins, so any
// codec padding at either end of the file stays outside it.
const from = 36;
const length = 40;
const fade = 1;
const margin = 0.5;

if (!existsSync(source)) {
  mkdirSync(dirname(source), { recursive: true });
  execFileSync('curl', [
    '-sfL',
    '-o',
    source,
    'https://cdn.freesound.org/previews/860/860228_17078888-hq.mp3',
  ]);
}

const raw = execFileSync(
  'ffmpeg',
  [
    '-v',
    'error',
    '-ss',
    String(from),
    '-t',
    String(length + fade),
    '-i',
    source,
    '-ac',
    '2',
    '-ar',
    String(rate),
    '-f',
    'f32le',
    '-',
  ],
  { maxBuffer: 1 << 28 }
);
const input = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const frames = length * rate;
const loop = input.slice(0, frames * 2);
// The end of the loop crossfades into its start with equal power, so the seam has no bump
for (let frame = 0; frame < fade * rate; frame++) {
  const angle = (frame / (fade * rate)) * Math.PI * 0.5;
  for (let channel = 0; channel < 2; channel++) {
    const index = frame * 2 + channel;
    loop[index] = input[index] * Math.sin(angle) + input[frames * 2 + index] * Math.cos(angle);
  }
}

// Level the loop to -18 dBFS RMS without letting peaks clip
let sum = 0;
let peak = 0;
for (const sample of loop) {
  sum += sample * sample;
  peak = Math.max(peak, Math.abs(sample));
}
const gain = Math.min(10 ** (-18 / 20) / Math.sqrt(sum / loop.length), 0.95 / peak);
const edge = margin * rate * 2;
const padded = new Float32Array(loop.length + edge * 2);
padded.set(loop.subarray(loop.length - edge), 0);
padded.set(loop, edge);
padded.set(loop.subarray(0, edge), edge + loop.length);
for (let index = 0; index < padded.length; index++) padded[index] *= gain;

mkdirSync(dirname(output), { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-v',
    'error',
    '-y',
    '-f',
    'f32le',
    '-ar',
    String(rate),
    '-ac',
    '2',
    '-i',
    '-',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '5',
    '-f',
    'mp3',
    `${output}.tmp`,
  ],
  { input: Buffer.from(padded.buffer) }
);
renameSync(`${output}.tmp`, output);
console.log(`Wrote ${output} (${length}s loop with ${margin}s margins)`);
