import { build } from 'vite';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, 'html');
const available = new Set(await readdir(resolve(project, 'public'), { recursive: true }));
const assets = new Map();
const result = await build({
  root: project,
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [
    {
      name: 'embed-presentation-assets',
      enforce: 'pre',
      transform(code, id) {
        if (!id.startsWith(resolve(project, 'src') + '/')) return;
        const literals = code.replace(/(['"])(\.\/[^'"\n]+)\1/g, (literal, _quote, path) => {
          if (!available.has(path.slice(2))) return literal;
          assets.set(path, null);
          return `globalThis.__presentationAsset(${JSON.stringify(path)})`;
        });
        return literals.replace(/`(\.\/[^`]+)`/g, (literal, path) => {
          const pattern = new RegExp(
            '^' +
              path
                .slice(2)
                .split(/\$\{[^}]+\}/)
                .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('.*') +
              '$'
          );
          const matches = [...available].filter((file) => pattern.test(file));
          if (!matches.length) return literal;
          for (const file of matches) assets.set('./' + file, null);
          return `globalThis.__presentationAsset(${literal})`;
        });
      },
    },
  ],
  experimental: {
    renderBuiltUrl(filename) {
      return { runtime: `globalThis.__presentationAsset(${JSON.stringify('./' + filename)})` };
    },
  },
  build: {
    write: false,
    minify: true,
    lib: { entry: resolve(project, 'src/main.tsx'), name: 'Presentation', formats: ['es'] },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const files = (Array.isArray(result) ? result : [result]).flatMap((build) => build.output);
for (const path of assets.keys()) assets.set(path, await readFile(resolve(project, 'public', path)));
for (const file of files) {
  if (file.type === 'asset' && !file.fileName.endsWith('.css')) {
    assets.set('./' + file.fileName, Buffer.from(file.source));
  }
}
const types = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const scripts = files.filter((file) => file.type === 'chunk');
if (scripts.length !== 1) throw new Error('The offline presentation must contain one script bundle');
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Poimandres</title>
<style>${files
  .filter((file) => file.fileName.endsWith('.css'))
  .map((file) => file.source)
  .join('\n')}</style>
</head><body><div id="root"></div>
${Array.from(assets, ([path, bytes]) => `<script type="application/octet-stream" data-asset="${path}" data-mime="${types[extname(path)] ?? 'application/octet-stream'}">${bytes.toString('base64')}</script>`).join('\n')}
<script>
{
  const assets = new Map(Array.from(document.querySelectorAll('[data-asset]'), element => [element.dataset.asset, element]));
  const urls = new Map();
  globalThis.__presentationAsset = path => {
    if (urls.has(path)) return urls.get(path);
    const element = assets.get(path);
    if (!element) throw new Error('Missing embedded asset: ' + path);
    const binary = atob(element.textContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: element.dataset.mime }));
    urls.set(path, url);
    element.remove();
    assets.delete(path);
    return url;
  };
}
</script>
<script type="module">${scripts[0].code.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.html'), html);
await writeFile(
  resolve(output, 'README.txt'),
  `OFFLINE PRESENTATION

Unzip html.zip, then open html/index.html in Chrome.
Everything is embedded in this file. No server, terminal, installation, or internet connection is needed.
Use a browser with WebGPU support. This package is not tied to a particular Mac processor.

Space, Right arrow, or Page Down: next scene.
Left arrow or Page Up: previous scene.

All presentation videos, images, models, and fonts are embedded in index.html.
Transfer html.zip, the html folder, or just index.html.
To rebuild from the source project: pnpm build:offline
`
);
execFileSync('/usr/bin/ditto', [
  '-c',
  '-k',
  '--norsrc',
  '--noextattr',
  '--keepParent',
  output,
  `${output}.zip.tmp`,
]);
await rename(`${output}.zip.tmp`, `${output}.zip`);
console.log(`Standalone presentation ready: ${output}.zip (${assets.size} embedded assets).`);
