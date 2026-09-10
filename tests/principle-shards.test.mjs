import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { Box3, Mesh, ShapeGeometry, Vector3 } from 'three/webgpu';
import { createServer } from 'vite';

let server;
let shards;
let font;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  shards = await server.ssrLoadModule('/src/view/principle-shards.ts');
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

void test('a word shatters into little pieces that each land on the mark', () => {
  const words = new ShapeGeometry(font.generateShapes('Open', 1.42));
  const geometry = shards.createShardGeometry(words, 5, 0.16);
  const pieces = geometry.userData.pieces;
  assert(pieces > 40 && pieces < 400, `${pieces} pieces`);
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
    assert(spread < 0.4, `vertex ${vertex} is ${spread} from its center`);
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
    // Every piece grows on landing so neighbours overlap
    assert(cloud.getZ(vertex) >= 1 && cloud.getZ(vertex) <= 6);
  }
  assert.equal(centers.size, pieces);
  const repeat = shards.createShardGeometry(words, 5, 0.16);
  assert.deepEqual(repeat.getAttribute('landing').array, landing.array);
});

void test('empty words produce an empty geometry instead of failing', () => {
  const geometry = shards.createShardGeometry(new ShapeGeometry([]), 5);
  assert.equal(geometry.getAttribute('position'), undefined);
});
