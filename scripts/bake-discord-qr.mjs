import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';

// Bake the Poimandres Discord invite in the deck's pixel language: square modules with the same gaps
// as the blocks of the PMNDRS mark, black on a transparent ground so the closing screen's cyan
// supplies the contrast and quiet zone. The finder squares stay solid for every camera to lock on,
// and the mark sits at the center, which the highest error correction lets the code carry.
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
    blocks.push(`M${x + inset} ${y + inset}h${1 - inset * 2}v${1 - inset * 2}h${-(1 - inset * 2)}z`);
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
