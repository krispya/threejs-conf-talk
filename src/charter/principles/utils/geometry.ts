import type { GlyphLayoutInspection } from '@pmndrs/glyph/three';
import { mulberry32 } from 'math/random';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector3 } from 'three/webgpu';

/**
 * The Poimandres mark traced from logo.svg in github.com/pmndrs/branding. Each box is
 * [left, bottom, right, top] inside the unit square with y up, so the mark is centered at 0.5.
 */
export const logoBoxes = [
  [0.35, 0, 0.65, 0.3],
  [0.35, 0.35, 0.65, 0.65],
  [0, 0.35, 0.3, 0.65],
  [0.35, 0.7, 0.7, 1],
  [0.7, 0.35, 1, 1],
] as const;

/** The mark as solid geometry, `size` units across and centered on the origin. */
export function createLogoGeometry(size: number) {
  return new ShapeGeometry(
    logoBoxes.map(([left, bottom, right, top]) =>
      new Shape()
        .moveTo((left - 0.5) * size, (bottom - 0.5) * size)
        .lineTo((right - 0.5) * size, (bottom - 0.5) * size)
        .lineTo((right - 0.5) * size, (top - 0.5) * size)
        .lineTo((left - 0.5) * size, (top - 0.5) * size)
        .closePath()
    )
  );
}

/**
 * Solid outlines for a laid out word. The text engine reports each glyph's ink box, and the
 * baked typeface supplies the outline for the same character, so every outline is placed by
 * matching box centers. The result is in the text's local space, shifted by the offset.
 */
export function createWordGeometry(
  font: Font,
  word: string,
  layout: GlyphLayoutInspection,
  offsetX: number,
  offsetY: number
) {
  const glyphs: BufferGeometry[] = [];
  const bounds = new Vector3();
  for (let index = 0; index < layout.glyphCount; index++) {
    const width = layout.glyphInkWidths[index]!;
    const height = layout.glyphInkHeights[index]!;
    if (width <= 0 || height <= 0) continue;
    const char = word[layout.clusters[index]!];
    if (!char || char === ' ') continue;
    const geometry = new ShapeGeometry(font.generateShapes(char, layout.glyphFontSizes[index]));
    geometry.computeBoundingBox();
    geometry.boundingBox!.getCenter(bounds);
    // Paragraph space runs y down from the top left, text space runs y up
    geometry.translate(
      offsetX + layout.glyphInkX[index]! + width / 2 - bounds.x,
      offsetY - layout.glyphInkY[index]! - height / 2 - bounds.y,
      0
    );
    glyphs.push(geometry);
  }
  return glyphs.length ? mergeGeometries(glyphs) : null;
}

/**
 * Break the words into little pieces that each fly to a spot on the mark. The outlines are cut
 * into fine triangles, and each triangle joins the nearest of a jittered grid of seeds, so the
 * pieces tear along irregular edges about `spacing` across. Every vertex carries its piece's
 * center, landing, drift, swell, and timing, so the shader can move each piece as one rigid body.
 * Landings are spread evenly over a mark `size` units across, and the swell scales each piece
 * up to a generous share of that area so the settled pieces melt together and cover the mark.
 * Pieces and landings are both ordered left to right, so neighbours travel together and the
 * mark forms as a sweep. Each impulse blows rightward with lift, like a gust from the left.
 */
export function createShardGeometry(words: BufferGeometry, size: number, spacing = 0.16, seed = 7) {
  const random = mulberry32.create(seed);
  const next = () => mulberry32.sample(random);
  const fine = new TessellateModifier(spacing * 0.45, 8).modify(words.toNonIndexed());
  const position = fine.getAttribute('position');
  const triangles = position.count / 3;
  const shards = new BufferGeometry();
  if (triangles === 0) return shards;

  fine.computeBoundingBox();
  const { min, max } = fine.boundingBox!;
  const columns = Math.ceil((max.x - min.x) / spacing) + 1;
  const rows = Math.ceil((max.y - min.y) / spacing) + 1;
  const seedX = new Float32Array(columns * rows);
  const seedY = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      seedX[row * columns + column] = min.x + (column + next()) * spacing;
      seedY[row * columns + column] = min.y + (row + next()) * spacing;
    }
  }

  // Each triangle joins the nearest seed among the surrounding cells
  const cellOf = new Int32Array(triangles);
  const centroidX = new Float32Array(triangles);
  const centroidY = new Float32Array(triangles);
  const area = new Float32Array(triangles);
  for (let triangle = 0; triangle < triangles; triangle++) {
    const a = triangle * 3;
    const cx = (position.getX(a) + position.getX(a + 1) + position.getX(a + 2)) / 3;
    const cy = (position.getY(a) + position.getY(a + 1) + position.getY(a + 2)) / 3;
    centroidX[triangle] = cx;
    centroidY[triangle] = cy;
    area[triangle] =
      Math.abs(
        (position.getX(a + 1) - position.getX(a)) * (position.getY(a + 2) - position.getY(a)) -
          (position.getY(a + 1) - position.getY(a)) * (position.getX(a + 2) - position.getX(a))
      ) / 2;
    const column = Math.floor((cx - min.x) / spacing);
    const row = Math.floor((cy - min.y) / spacing);
    let best = -1;
    let bestDistance = Infinity;
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (let c = Math.max(0, column - 1); c <= Math.min(columns - 1, column + 1); c++) {
        const cell = r * columns + c;
        const dx = seedX[cell]! - cx;
        const dy = seedY[cell]! - cy;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cell;
        }
      }
    }
    cellOf[triangle] = best;
  }

  // Compact the occupied cells into pieces with area weighted centers
  const pieceOfCell = new Int32Array(columns * rows).fill(-1);
  const centerX: number[] = [];
  const centerY: number[] = [];
  const weight: number[] = [];
  const pieceOf = new Int32Array(triangles);
  for (let triangle = 0; triangle < triangles; triangle++) {
    const cell = cellOf[triangle]!;
    let piece = pieceOfCell[cell]!;
    if (piece < 0) {
      piece = centerX.length;
      pieceOfCell[cell] = piece;
      centerX.push(0);
      centerY.push(0);
      weight.push(0);
    }
    pieceOf[triangle] = piece;
    centerX[piece]! += centroidX[triangle]! * area[triangle]!;
    centerY[piece]! += centroidY[triangle]! * area[triangle]!;
    weight[piece]! += area[triangle]!;
  }
  const pieces = centerX.length;
  for (let piece = 0; piece < pieces; piece++) {
    // A piece of zero area keeps its first centroid instead of dividing by zero
    const total = weight[piece]! || 1;
    centerX[piece]! /= total;
    centerY[piece]! /= total;
  }

  // Pair pieces with landings in left to right order
  const pieceOrder = new Uint32Array(pieces);
  for (let piece = 0; piece < pieces; piece++) pieceOrder[piece] = piece;
  pieceOrder.sort((a, b) => centerX[a]! - centerX[b]!);
  const landings = spreadOverLogo(pieces, size, next);
  const landingOrder = sortByX(landings, pieces);
  const share = (logoArea() * size * size) / pieces;
  const landing = new Float32Array(pieces * 3);
  const cloud = new Float32Array(pieces * 3);
  const timing = new Float32Array(pieces * 4);
  for (let rank = 0; rank < pieces; rank++) {
    const piece = pieceOrder[rank]!;
    const target = landingOrder[rank]! * 3;
    landing[piece * 3] = landings[target]!;
    landing[piece * 3 + 1] = landings[target + 1]!;
    landing[piece * 3 + 2] = 0;
    cloud[piece * 3] = 2 + next() * 5;
    cloud[piece * 3 + 1] = 1.5 + next() * 5;
    // Grow each piece to about three times its share so neighbours overlap without gaps
    cloud[piece * 3 + 2] = Math.min(
      6,
      Math.max(1, Math.sqrt((3 * share) / (weight[piece]! || share)))
    );
    timing[piece * 4] = (rank / pieces) * 0.6 + next() * 0.4;
    timing[piece * 4 + 1] = (rank / pieces) * 0.5 + next() * 0.5;
    timing[piece * 4 + 2] = next();
    timing[piece * 4 + 3] = next();
  }

  // Expand piece data onto every vertex
  const vertices = position.count;
  const center = new Float32Array(vertices * 3);
  const vertexLanding = new Float32Array(vertices * 3);
  const vertexCloud = new Float32Array(vertices * 3);
  const vertexTiming = new Float32Array(vertices * 4);
  for (let vertex = 0; vertex < vertices; vertex++) {
    const piece = pieceOf[Math.floor(vertex / 3)]!;
    center[vertex * 3] = centerX[piece]!;
    center[vertex * 3 + 1] = centerY[piece]!;
    center[vertex * 3 + 2] = 0;
    vertexLanding.set(landing.subarray(piece * 3, piece * 3 + 3), vertex * 3);
    vertexCloud.set(cloud.subarray(piece * 3, piece * 3 + 3), vertex * 3);
    vertexTiming.set(timing.subarray(piece * 4, piece * 4 + 4), vertex * 4);
  }
  shards.setAttribute('position', position);
  shards.setAttribute('center', new Float32BufferAttribute(center, 3));
  shards.setAttribute('landing', new Float32BufferAttribute(vertexLanding, 3));
  shards.setAttribute('cloud', new Float32BufferAttribute(vertexCloud, 3));
  shards.setAttribute('timing', new Float32BufferAttribute(vertexTiming, 4));
  shards.userData.pieces = pieces;
  return shards;
}

/** Area of the mark inside the unit square. */
function logoArea() {
  let area = 0;
  for (const [left, bottom, right, top] of logoBoxes) area += (right - left) * (top - bottom);
  return area;
}

/**
 * `count` landing points spread evenly over the mark, centered on the origin. Each box gets a
 * jittered grid in proportion to its area, then the total is trimmed or topped up at random.
 */
function spreadOverLogo(count: number, size: number, random: () => number) {
  const spacing = Math.sqrt((logoArea() * size * size) / Math.max(1, count * 1.1));
  const candidates: number[] = [];
  for (const [left, bottom, right, top] of logoBoxes) {
    const width = (right - left) * size;
    const height = (top - bottom) * size;
    const columns = Math.max(1, Math.round(width / spacing));
    const rows = Math.max(1, Math.round(height / spacing));
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        candidates.push(
          (left - 0.5) * size + ((column + random()) / columns) * width,
          (bottom - 0.5) * size + ((row + random()) / rows) * height
        );
      }
    }
  }
  while (candidates.length / 2 < count) {
    // Top up inside a box chosen by area
    let draw = random() * logoArea();
    for (const [left, bottom, right, top] of logoBoxes) {
      draw -= (right - left) * (top - bottom);
      if (draw > 0) continue;
      candidates.push(
        (left + random() * (right - left) - 0.5) * size,
        (bottom + random() * (top - bottom) - 0.5) * size
      );
      break;
    }
  }
  // Shuffle so trimming the tail drops points from everywhere
  for (let index = candidates.length / 2 - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    for (let axis = 0; axis < 2; axis++) {
      const swap = candidates[index * 2 + axis]!;
      candidates[index * 2 + axis] = candidates[other * 2 + axis]!;
      candidates[other * 2 + axis] = swap;
    }
  }
  const points = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    points[index * 3] = candidates[index * 2]!;
    points[index * 3 + 1] = candidates[index * 2 + 1]!;
  }
  return points;
}

function sortByX(points: Float32Array, count: number) {
  const order = new Uint32Array(count);
  for (let index = 0; index < count; index++) order[index] = index;
  return order.sort((a, b) => points[a * 3]! - points[b * 3]!);
}
