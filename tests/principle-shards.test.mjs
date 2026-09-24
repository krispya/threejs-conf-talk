import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { Box3, Mesh, ShapeGeometry, Vector3 } from 'three/webgpu';
import { createServer } from 'vite';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let server;
let shards;
let font;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  shards = await server.ssrLoadModule('/src/charter/principles/utils/geometry.ts');
  font = new Font(
    JSON.parse(await readFile(new URL('../public/fonts/geist-black.typeface.json', import.meta.url)))
  );
});
after(async () => {
  await server?.close();
});

void test('the mark is five boxes inside the unit square, centered', () => {
  const union = new Box3();
  for (const [left, bottom, right, top] of shards.logoBoxes) {
    assert(left >= 0 && bottom >= 0 && right <= 1 && top <= 1 && left < right && bottom < top);
    union.expandByPoint({ x: left, y: bottom, z: 0 }).expandByPoint({ x: right, y: top, z: 0 });
  }
  assert.deepEqual([union.min.x, union.min.y, union.max.x, union.max.y], [0, 0, 1, 1]);
});

void test('word outlines land on the ink boxes the text engine reports', () => {
  const size = 1.42;
  const outline = new ShapeGeometry(font.generateShapes('S', size));
  outline.computeBoundingBox();
  const width = outline.boundingBox.max.x - outline.boundingBox.min.x;
  const height = outline.boundingBox.max.y - outline.boundingBox.min.y;
  // Paragraph space places the ink box top left at (0.2, 0.1) with y down
  const geometry = shards.createWordGeometry(
    font,
    'S ',
    {
      glyphCount: 2,
      clusters: new Uint32Array([0, 1]),
      glyphFontSizes: new Float32Array([size, size]),
      glyphInkX: new Float32Array([0.2, 1]),
      glyphInkY: new Float32Array([0.1, 0]),
      glyphInkWidths: new Float32Array([width, 0]),
      glyphInkHeights: new Float32Array([height, 0]),
    },
    1,
    -2
  );
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new Vector3());
  assert(Math.abs(geometry.boundingBox.min.x - (1 + 0.2)) < 1e-5);
  assert(Math.abs(geometry.boundingBox.max.y - (-2 - 0.1)) < 1e-5);
  assert(Math.abs(geometry.boundingBox.max.x - geometry.boundingBox.min.x - width) < 1e-5);
  assert(center.x > 1.2 && center.y < -2.1);
});

void test('letter scraps preserve the word and trickle into a loose collage of the mark', () => {
  const words = new ShapeGeometry(font.generateShapes('Open', 1.42));
  const geometry = shards.createShardGeometry(words, 5);
  const pieces = geometry.userData.pieces;
  assert(pieces > 15 && pieces < 150, `${pieces} pieces`);
  const position = geometry.getAttribute('position');
  const center = geometry.getAttribute('center');
  const landing = geometry.getAttribute('landing');
  const timing = geometry.getAttribute('timing');
  const cloud = geometry.getAttribute('cloud');
  assert.equal(position.count % 3, 0);
  // The pieces together are still the whole word
  const wordBounds = new Box3().setFromObject(new Mesh(words));
  const shardBounds = new Box3().setFromBufferAttribute(position);
  assert(wordBounds.min.distanceTo(shardBounds.min) < 1e-4);
  assert(wordBounds.max.distanceTo(shardBounds.max) < 1e-4);
  const boxes = shards.logoBoxes.map((box) => box.map((edge) => (edge - 0.5) * 5));
  const centers = new Set();
  for (let vertex = 0; vertex < position.count; vertex++) {
    // A piece is small and every vertex stays near its own center
    const spread = Math.hypot(
      position.getX(vertex) - center.getX(vertex),
      position.getY(vertex) - center.getY(vertex)
    );
    assert(spread < 0.7, `vertex ${vertex} is ${spread} from its center`);
    centers.add(`${center.getX(vertex)},${center.getY(vertex)}`);
    const x = landing.getX(vertex);
    const y = landing.getY(vertex);
    assert(
      boxes.some(([left, bottom, right, top]) => x >= left && x <= right && y >= bottom && y <= top),
      `landing ${x}, ${y} is off the mark`
    );
    for (let lane = 0; lane < 4; lane++) {
      const value = timing.array[vertex * 4 + lane];
      assert(value >= 0 && value < 1);
    }
    // Overlapping scraps retain varied sizes and leave the logo readable
    assert(cloud.getZ(vertex) >= 0.79 && cloud.getZ(vertex) <= 3.5);
    assert(timing.getX(vertex) + timing.getY(vertex) < 1, 'Every scrap lands before the beat ends');
  }
  assert.equal(centers.size, pieces);
  const repeat = shards.createShardGeometry(words, 5);
  assert.deepEqual(repeat.getAttribute('landing').array, landing.array);
});

void test('words break apart from top to bottom with overlapping releases and build the whole mark early', () => {
  const outlines = ['Simple', 'Pragmatic', 'Stable', 'Open', 'Tasteful*'].map((word, index) =>
    new ShapeGeometry(font.generateShapes(word, 1.42)).translate(0, -index * 1.36, 0)
  );
  const lines = outlines.map((outline) => {
    outline.computeBoundingBox();
    const { min, max } = outline.boundingBox;
    return { left: min.x, right: max.x, bottom: min.y, top: max.y };
  });
  const words = mergeGeometries(outlines);
  const geometry = shards.createShardGeometry(words, 5.2, { lines });
  const center = geometry.getAttribute('center');
  const timing = geometry.getAttribute('timing');
  const landing = geometry.getAttribute('landing');
  const starts = lines.map(() => Infinity);
  const ends = lines.map(() => 0);
  const arrivals = lines.map(() => Infinity);
  const blocks = new Set();
  let waiting = 0;
  let flying = 0;
  let landed = 0;
  for (let vertex = 0; vertex < center.count; vertex++) {
    const row = lines.findIndex(
      (line) => center.getY(vertex) >= line.bottom && center.getY(vertex) <= line.top
    );
    const release = timing.getX(vertex);
    const arrival = release + timing.getY(vertex);
    if (row >= 0) {
      starts[row] = Math.min(starts[row], release);
      ends[row] = Math.max(ends[row], release);
      arrivals[row] = Math.min(arrivals[row], arrival);
    }
    if (release > 0.5) waiting++;
    else if (arrival > 0.5) flying++;
    else landed++;
    if (arrival <= 0.6) {
      const x = landing.getX(vertex) / 5.2 + 0.5;
      const y = landing.getY(vertex) / 5.2 + 0.5;
      blocks.add(
        shards.logoBoxes.findIndex(
          ([left, bottom, right, top]) => x >= left && x <= right && y >= bottom && y <= top
        )
      );
    }
  }
  for (let row = 1; row < lines.length; row++) {
    assert(starts[row] > starts[row - 1], 'Words begin breaking from top to bottom');
    assert(
      starts[row] < ends[row - 1],
      'The next word starts while the previous word is still breaking'
    );
  }
  assert(starts.at(-1) < arrivals[0], 'Every word has begun before the first word finishes arriving');
  assert(
    waiting > 0 && flying > 0 && landed > 0,
    'Text, moving scraps, and logo coexist midway through'
  );
  assert.equal(blocks.size, 5, 'Early arrivals establish every block of the logo');
  geometry.dispose();
  words.dispose();
  for (const outline of outlines) outline.dispose();
});

void test('empty words produce an empty geometry instead of failing', () => {
  const geometry = shards.createShardGeometry(new ShapeGeometry([]), 5);
  assert.equal(geometry.getAttribute('position'), undefined);
});
