import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import QRCode from 'qrcode';
import { createHighlighter } from 'shiki';
import { codeExamples } from '../src/package/comparison/data.ts';
import { bakeVideo, bakeSound } from './bake-media.mjs';
import { bakeTextures } from './bake-textures.mjs';

const [target, ...args] = process.argv.slice(2).filter((arg) => arg !== '--');
if (target === '--help' || target === '-h') {
  console.log(`Usage: pnpm bake [target] [options]

No target rebuilds fonts and code images.

  fonts          Geist fonts and geometry outlines
  code           Syntax-highlighted code images
  discord-qr     Closing Discord QR code
  textures       All browser textures
  nebula         Nebula texture
  environment    Studio lighting texture
  emoji          Emoji textures
  glyph          Glyph video reel
  math           Math video
  experimental   Experimental video
  games          Games video reel
  design-system  Design system video reel
  r3f-v10        React Three Fiber video reel
  sound          Cabin sound loop
  star-map       Star atlas, requires a catalog CSV path

Browser texture targets accept --no-open.
Example: pnpm bake star-map /path/to/hygdata_v41.csv
See README.md for media source overrides.`);
  process.exit(0);
}
if (target === 'star-map') {
  if (args.length !== 1) throw new Error('Usage: pnpm bake star-map /path/to/hygdata_v41.csv');
} else if (['textures', 'nebula', 'environment', 'emoji'].includes(target)) {
  if (args.some((arg) => arg !== '--no-open')) throw new Error('Only --no-open is supported');
} else if (args.length) {
  throw new Error('Unexpected arguments. Run pnpm bake --help for usage');
}

switch (target) {
  case undefined:
    await bakeFonts();
    await bakeCode();
    break;
  case 'fonts':
    await bakeFonts();
    break;
  case 'code':
    await bakeCode();
    break;
  case 'discord-qr':
    await bakeQr();
    break;
  case 'star-map':
    await bakeStars(args[0]);
    break;
  case 'textures':
  case 'nebula':
  case 'environment':
  case 'emoji':
    await bakeTextures(
      target === 'textures' ? ['nebula', 'environment', 'emoji'] : [target],
      !args.includes('--no-open')
    );
    break;
  case 'sound':
    bakeSound();
    break;
  case 'glyph':
  case 'math':
  case 'experimental':
  case 'games':
  case 'design-system':
  case 'r3f-v10':
    bakeVideo(target);
    break;
  default:
    throw new Error(`Unknown bake target: ${target}. Run pnpm bake --help for usage`);
}

async function bakeFonts() {
  for (const [input, output] of [
    ['Geist-Black', 'geist-black'],
    ['Geist-Regular', 'geist-regular'],
    ['GeistMono-Medium', 'geist-mono'],
  ]) {
    execFileSync(
      'pnpm',
      [
        'exec',
        'glyph',
        'bake',
        '--input',
        `public/fonts/${input}.ttf`,
        '--output',
        `public/fonts/${output}.font.glb`,
        '--unicodes',
        'U+0020-007E',
        '--msdf',
        '--slug',
      ],
      { stdio: 'inherit' }
    );
  }
  const source = await readFile(new URL('../public/fonts/Geist-Black.ttf', import.meta.url));
  const font = opentype.parse(
    source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
  );
  const glyphs = {};

  for (let code = 32; code <= 126; code++) {
    const char = String.fromCodePoint(code);
    const glyph = font.charToGlyph(char);
    const bounds = glyph.getBoundingBox();
    glyphs[char] = {
      ha: glyph.advanceWidth,
      x_min: bounds.x1,
      x_max: bounds.x2,
      o: glyph.path.commands
        .flatMap((command) => {
          switch (command.type) {
            case 'M':
            case 'L':
              return [command.type.toLowerCase(), command.x, command.y];
            case 'Q':
              return ['q', command.x, command.y, command.x1, command.y1];
            case 'C':
              return ['b', command.x, command.y, command.x1, command.y1, command.x2, command.y2];
            default:
              return [];
          }
        })
        .join(' '),
    };
  }

  await writeFile(
    new URL('../public/fonts/geist-black.typeface.json', import.meta.url),
    JSON.stringify(
      {
        glyphs,
        familyName: 'Geist Black',
        ascender: font.ascender,
        descender: font.descender,
        underlinePosition: font.tables.post.underlinePosition,
        underlineThickness: font.tables.post.underlineThickness,
        boundingBox: {
          xMin: font.tables.head.xMin,
          xMax: font.tables.head.xMax,
          yMin: font.tables.head.yMin,
          yMax: font.tables.head.yMax,
        },
        resolution: font.unitsPerEm,
        original_font_information: { license: 'SIL Open Font License 1.1' },
      },
      null,
      2
    ) + '\n'
  );
}

async function bakeCode() {
  const highlighter = await createHighlighter({
    themes: ['github-dark-default'],
    langs: ['javascript', 'jsx'],
  });
  const source = await readFile(new URL('../public/fonts/GeistMono-Medium.ttf', import.meta.url));
  const font = opentype.parse(
    source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
  );
  const output = new URL('../public/code/', import.meta.url);
  await mkdir(output, { recursive: true });

  for (const example of codeExamples) {
    const { tokens } = highlighter.codeToTokens(example.code, {
      lang: example.language,
      theme: 'github-dark-default',
    });
    const paths = tokens.flatMap((line, index) => {
      let x = 0;
      return line.map((token) => {
        const path = font.getPath(token.content, x, 92 + index * 130, 100);
        x += font.getAdvanceWidth(token.content, 100);
        const outline = path.commands
          .map(
            (command) =>
              command.type +
              ['x1', 'y1', 'x2', 'y2', 'x', 'y']
                .filter((key) => key in command)
                .map((key) => command[key].toFixed(3))
                .join(' ')
          )
          .join('');
        return `<path d="${outline}" fill="${token.color}"/>`;
      });
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2160" height="1160" viewBox="0 0 2160 1160">${paths.join('')}</svg>`;
    const png = new Resvg(svg).render().asPng();
    await writeFile(new URL(`${example.id}.png`, output), png);
    console.log(`Baked ${example.id}.png (${Math.round(png.length / 1024)} KB)`);
  }

  highlighter.dispose();
}

async function bakeQr() {
  // Square modules echo the mark while solid finders keep the code readable
  const output = new URL('../public/closing/', import.meta.url);
  await mkdir(output, { recursive: true });
  const { modules } = QRCode.create('https://discord.gg/poimandres', { errorCorrectionLevel: 'H' });
  const size = modules.size;
  const finders = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  // The mark covers seven modules at the center with a module of clear ground around it
  const mark = (size - 7) / 2;
  const reserved = (x, y) =>
    finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7) ||
    (x >= mark - 1 && x < mark + 8 && y >= mark - 1 && y < mark + 8);

  // Each block fills 12.5 of the mark's 15 unit pitch
  const inset = (1 - 12.5 / 15) / 2;
  const blocks = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules.get(y, x) || reserved(x, y)) continue;
      blocks.push(
        `M${x + inset} ${y + inset}h${1 - inset * 2}v${1 - inset * 2}h${-(1 - inset * 2)}z`
      );
    }
  }
  const eyes = finders
    .map(([x, y]) => `M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z M${x + 2} ${y + 2}h3v3h-3z`)
    .join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <path d="${eyes}" fill="#000000" fill-rule="evenodd" />
    <path d="${blocks.join(' ')}" fill="#000000" />
    <g transform="translate(${mark} ${mark}) scale(0.07)">
      <rect width="100" height="100" fill="#000000" />
      <path d="M43.75 28.75h27.5v27.5h-12.5v-15h-15z M28.75 43.75h12.5v12.5h-12.5z M43.75 43.75h12.5v12.5h-12.5z M43.75 58.75h12.5v12.5h-12.5z" fill="#ffffff" />
    </g>
  </svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
  await writeFile(new URL('discord-qr.png', output), png);
  console.log(`Wrote discord-qr.png (${size} modules)`);
}

async function bakeStars(catalog) {
  // HYG v4.1, David Nash, CC BY-SA 4.0
  const csv = await readFile(catalog, 'utf8');
  const rows = csv.trim().split(/\r?\n/);
  const columns = rows
    .shift()
    .split(',')
    .map((name) => name.replaceAll('"', ''));
  const stars = [];
  for (const row of rows) {
    const fields = Array.from(row.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g), (match) =>
      match[1].replace(/^"|"$/g, '').replaceAll('""', '"')
    );
    const magnitude = Number(fields[columns.indexOf('mag')]);
    if (fields[0] === '0' || magnitude > 6.5 || !Number.isFinite(magnitude)) continue;
    const x = (Number(fields[columns.indexOf('ra')]) / 24) * 4096;
    const declination = Number(fields[columns.indexOf('dec')]);
    const y = ((90 - declination) / 180) * 2048;
    const brightness = Math.min(1, Math.max(0.2, 10 ** ((2 - magnitude) * 0.13)));
    const radius = 0.55 + brightness * 1.25;
    // Longitude contracts toward the poles, so widen the atlas footprint to keep stars round
    const width = radius / Math.max(0.05, Math.cos((declination * Math.PI) / 180));
    stars.push(
      [-4096, 0, 4096]
        .filter((offset) => x + offset + width >= 0 && x + offset - width <= 4096)
        .map(
          (offset) =>
            `<ellipse cx="${(x + offset).toFixed(3)}" cy="${y.toFixed(3)}" rx="${width.toFixed(3)}" ry="${radius.toFixed(3)}" fill="white" opacity="${brightness.toFixed(3)}"/>`
        )
        .join('')
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="2048"><rect width="4096" height="2048" fill="black"/>${stars.join('')}</svg>`;
  if (stars.length === 0) throw new Error('The catalog contains no usable stars');
  const output = new URL('../public/sky/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('hyg-stars.png', output), new Resvg(svg).render().asPng());
  console.log(`Baked ${stars.length} catalog stars into a 4096 × 2048 equirectangular map`);
}
