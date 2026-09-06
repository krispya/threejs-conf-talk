import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';

// Bake outlines for Three geometry without shipping a font parser to the browser.
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
