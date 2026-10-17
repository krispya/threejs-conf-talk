import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function bakeVideo(name) {
  const recipe = videoRecipe(name);
  const output = fileURLToPath(
    new URL(`../public/initiatives/${recipe.output}.mp4`, import.meta.url)
  );
  const sources = recipe.shots.map(({ file }) => resolve(recipe.media ?? '', file));
  for (const [index, shot] of recipe.shots.entries()) {
    if (!shot.post || existsSync(sources[index])) continue;
    mkdirSync(dirname(sources[index]), { recursive: true });
    execFileSync(
      'yt-dlp',
      [
        '--no-update',
        '--no-progress',
        '-f',
        'best[ext=mp4][protocol=https]/best[ext=mp4]',
        '-o',
        sources[index],
        `https://x.com/isaac_mason_/status/${shot.post}`,
      ],
      { stdio: 'inherit' }
    );
  }

  // Fit each capture inside the portal before joining the shots
  const filters = recipe.shots.map(
    ({ crop, from, to, trim = true }, index) =>
      `[${index}:v]${crop ? `crop=${crop},` : ''}` +
      `scale=${recipe.width ?? 720}:720${recipe.stretch ? '' : ':force_original_aspect_ratio=decrease:force_divisible_by=2'}:flags=lanczos,` +
      'pad=1280:720:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30,' +
      (to !== undefined && trim ? `trim=end_frame=${Math.round((to - from) * 30)},` : '') +
      `setsar=1,format=yuv420p[v${index}]`
  );
  mkdirSync(dirname(output), { recursive: true });
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...recipe.shots.flatMap(({ from, to }, index) => [
        ...(from === undefined ? [] : ['-ss', String(from)]),
        ...(to === undefined ? [] : ['-t', String(to - from)]),
        '-i',
        sources[index],
      ]),
      '-filter_complex',
      `${filters.join(';')};${recipe.shots.map((_, index) => `[v${index}]`).join('')}concat=n=${recipe.shots.length}:v=1:a=0[out]`,
      '-map',
      '[out]',
      '-an',
      '-c:v',
      'libx264',
      '-crf',
      String(recipe.crf ?? 18),
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
}

function videoRecipe(name) {
  switch (name) {
    case 'design-system':
      return {
        output: name,
        media: process.env.DESIGN_SYSTEM_MEDIA ?? resolve(homedir(), 'Downloads'),
        stretch: true,
        shots: [
          ['design1.mp4', 1],
          ['design2.mp4', 4],
          ['design3.mp4', 0],
          ['design1.mp4', 9],
          ['design2.mp4', 14],
          ['design1.mp4', 18],
          ['design2.mp4', 20],
          ['design3.mp4', 10],
        ].map(([file, from]) => ({ file, from, to: from + 2.5 })),
      };
    case 'experimental':
      return {
        output: name,
        media: process.env.EXPERIMENTAL_MEDIA ?? resolve(homedir(), 'Downloads'),
        shots: [{ file: 'klipp1.mp4' }, { file: 'kilpp2.mp4' }],
      };
    case 'games':
      return {
        output: name,
        media:
          process.env.GAMES_MEDIA ??
          fileURLToPath(new URL('../public/initiatives/games', import.meta.url)),
        shots: [
          {
            file: 'boiler-room.mp4',
            post: '2075454607237820797',
            from: 0.5,
            to: 6.5,
            crop: '1152:648:36:36',
          },
          {
            file: 'crashcat.mp4',
            post: '2021906714686280052',
            from: 2,
            to: 10,
            crop: '1188:560:24:90',
          },
          {
            file: 'navcat.mp4',
            post: '1988012661884555729',
            from: 7,
            to: 15,
            crop: '1046:652:34:34',
          },
          { file: 'wizard.mp4', post: '2027394705194119447', from: 1, to: 9, crop: '992:636:246:54' },
        ],
      };
    case 'glyph': {
      const media = process.env.GLYPH_MEDIA ?? resolve(homedir(), 'Downloads');
      const sources = {
        wordmark: resolve(media, 'glyph3.mov'),
        demo: fileURLToPath(new URL('../public/initiatives/glyph.mp4', import.meta.url)),
        cubes: resolve(media, 'glyph2.mov'),
      };
      return {
        output: 'glyph-reel',
        shots: [
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
        ].map(([source, from, to]) => ({ file: sources[source], from, to })),
      };
    }
    case 'math':
      return {
        output: 'mathzamples',
        shots: [
          {
            file: process.env.MATH_RECORDING ?? resolve(homedir(), 'Downloads/mathzamples.mp4'),
            crop: '2732:1992:724:90',
          },
        ],
      };
    case 'r3f-v10': {
      const sources = {
        hero: { file: 'track_promo.mp4', crop: '1984:1116:32:220' },
        reel: { file: 'track_promo.mp4', crop: '2048:1152:0:202' },
        game: { file: 'minecraft-like.mov', crop: '2758:1551:0:36' },
        watch: { file: 'faraz_watch.mov', crop: '2540:1428:0:111' },
        demos: {
          file:
            process.env.R3F_V10_RECORDING ??
            resolve(homedir(), 'Desktop/Screen Recording 2026-08-28 at 11.55.01 AM.mov'),
          crop: '1822:1588:0:0',
        },
      };
      return {
        output: name,
        media:
          process.env.PROMO_MEDIA ??
          fileURLToPath(new URL('../../minecraft-like/promo/media', import.meta.url)),
        width: 1280,
        crf: 20,
        shots: [
          ['hero', 5.56, 6.5],
          ['hero', 10.32, 12.4],
          ['reel', 7.66, 8.82],
          ['watch', 1, 4.33],
          ['reel', 15.4, 16.25],
          ['game', 1, 4.07],
          ['hero', 12.4, 15.12],
          ['game', 10, 12.39],
          ['demos', 0, 4.4],
          ['demos', 4.9, 10.3],
          ['demos', 11.9, 12.9],
          ['demos', 15.4, 16.9],
          ['demos', 17.4, 19.4],
          ['demos', 19.9, 21.9],
          ['demos', 22.3, 23.1],
          ['demos', 28.7, 31.6],
        ].map(([source, from, to]) => ({ ...sources[source], from, to, trim: source === 'demos' })),
      };
    }
    default:
      throw new Error(`Unknown video bake: ${name}`);
  }
}

export function bakeSound() {
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
}
