import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

// HYG v4.1, David Nash, CC BY-SA 4.0
// Pass the downloaded hygdata_v41.csv as the first argument
const csv = await readFile(process.argv[2], 'utf8');
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
