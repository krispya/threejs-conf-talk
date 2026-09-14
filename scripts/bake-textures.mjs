import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const requested = process.argv.slice(2).filter((arg) => arg !== '--no-open');
const groups = {
  nebula: ['nebula'],
  environment: ['environment'],
  emoji: ['wave', 'thinking', 'gear'],
};
for (const group of requested) {
  if (!(group in groups)) throw new Error(`Unknown bake: ${group}`);
}
const jobs = [
  ...new Set((requested.length ? requested : Object.keys(groups)).flatMap((group) => groups[group])),
];
const outputs = Object.fromEntries(
  jobs.map((name) => [
    name,
    new URL(
      name === 'nebula' || name === 'environment'
        ? `../public/sky/${name}.exr`
        : `../public/emoji/${name}.png`,
      import.meta.url
    ),
  ])
);
const pending = new Set(jobs);
let finish;
const completed = new Promise((resolve) => {
  finish = resolve;
});
const server = await createServer({
  cacheDir: 'node_modules/.vite-bake',
  optimizeDeps: {
    include: [
      'three/webgpu',
      'three/tsl',
      'three/addons/exporters/EXRExporter.js',
      'three/addons/loaders/EXRLoader.js',
      'three/addons/environments/RoomEnvironment.js',
    ],
  },
  server: { host: '127.0.0.1', port: 5180, strictPort: true, open: false },
  plugins: [
    {
      name: 'bake-textures',
      configureServer(server) {
        server.middlewares.use('/__bake-textures', async (request, response) => {
          try {
            if (request.method === 'POST') {
              const name = request.url.slice(1);
              if (!pending.has(name)) throw new Error('Unexpected bake output');
              const output = outputs[name];
              const chunks = [];
              let length = 0;
              for await (const chunk of request) {
                length += chunk.length;
                if (length > 32 * 1024 * 1024) throw new Error('Unexpected bake size');
                chunks.push(chunk);
              }
              const bytes = Buffer.concat(chunks);
              if (
                output.pathname.endsWith('.exr')
                  ? bytes.readUInt32LE(0) !== 20000630
                  : bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
              ) {
                throw new Error('Unexpected texture format');
              }
              await mkdir(new URL('.', output), { recursive: true });
              await writeFile(new URL(`${output.href}.tmp`), bytes);
              await rename(new URL(`${output.href}.tmp`), output);
              const message = `Saved ${output.pathname} (${Math.round(bytes.length / 1024)} KB)`;
              console.log(message);
              response.end(message);
              pending.delete(name);
              if (!pending.size) finish();
              return;
            }
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(
              await server.transformIndexHtml(
                '/__bake-textures',
                `<!doctype html>
<meta charset="utf-8"><title>Bake textures</title><pre id="status">Baking ${jobs.join(', ')}…</pre>
<script type="module">
import { WebGPURenderer, DataTexture, HalfFloatType, RGBAFormat } from 'three/webgpu';
import { EXRExporter } from 'three/addons/exporters/EXRExporter.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { bakeNebula, bakeEnvironment, bakeEmoji, orientEnvironment } from '/scripts/bake-textures.ts';
const jobs = ${JSON.stringify(jobs)};
const emoji = { wave: '👋', thinking: '🤔', gear: '⚙️' };
const renderer = jobs.some((name) => !(name in emoji)) ? new WebGPURenderer() : null;
try {
  if (renderer) await renderer.init();
  for (const name of jobs) {
    let bytes;
    if (name in emoji) {
      const canvas = bakeEmoji(emoji[name]);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      bytes = new Uint8Array(await blob.arrayBuffer());
      const bitmap = await createImageBitmap(blob);
      try {
        const decoded = document.createElement('canvas');
        decoded.width = decoded.height = 256;
        decoded.getContext('2d').drawImage(bitmap, 0, 0);
        const before = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
        const after = decoded.getContext('2d').getImageData(0, 0, 256, 256).data;
        if (before.some((value, i) => value !== after[i])) throw new Error(name + ' PNG round trip changed pixels');
      } finally { bitmap.close(); }
    } else {
      const target = name === 'nebula' ? bakeNebula(renderer) : bakeEnvironment(renderer);
      try {
        const original = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
        const pixels = name === 'environment' ? orientEnvironment(original, target.width, target.height) : original;
        const texture = new DataTexture(pixels, target.width, target.height, RGBAFormat, HalfFloatType);
        try {
          bytes = await new EXRExporter().parse(texture);
          const decoded = new EXRLoader().parse(bytes.buffer);
          if (pixels.some((value, i) => value !== decoded.data[i])) throw new Error(name + ' EXR round trip changed channel values');
        } finally { texture.dispose(); }
      } finally { target.dispose(); }
    }
    const response = await fetch('/__bake-textures/' + name, { method: 'POST', body: bytes });
    if (!response.ok) throw new Error(await response.text());
    document.getElementById('status').textContent += '\\n' + await response.text();
  }
} catch (error) {
  document.getElementById('status').textContent = String(error);
  console.error(error);
} finally { renderer?.dispose(); }
</script>`
              )
            );
          } catch (error) {
            response.statusCode = 500;
            response.end(String(error));
          }
        });
      },
    },
  ],
});
try {
  await server.listen();
  console.log('Open http://127.0.0.1:5180/__bake-textures in a WebGPU browser.');
  if (!process.argv.includes('--no-open')) {
    server.config.server.open = '/__bake-textures';
    server.openBrowser();
  }
  await completed;
} finally {
  await server.close();
}
