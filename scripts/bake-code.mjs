import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import { createHighlighter } from 'shiki';
import { codeExamples } from '../src/data/code-examples.ts';

// Bake syntax colors and font outlines so code renders as two static textures.
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
