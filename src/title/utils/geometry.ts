import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { BufferGeometry, Float32BufferAttribute, ShapeGeometry } from 'three/webgpu';

import type { Font } from 'three/addons/loaders/FontLoader.js';

export function createTitleGeometry(font: Font, text: string) {
  return text.split('\n').map((line) => {
    const shapes = font.generateShapes(line, 1);
    const vertices: number[] = [];
    const fragmentPositions: number[] = [];
    const fragmentUvs: number[] = [];
    const fragmentData: number[] = [];
    const fragmentIndices: number[] = [];
    // Smooth contour rings and spaced depth rails keep the extrusion legible.
    for (const shape of shapes) {
      for (const path of [shape, ...shape.holes]) {
        const contour = path.getPoints(12);
        for (const point of path.getSpacedPoints(Math.max(4, Math.ceil(path.getLength() / 0.12)))) {
          const offset = fragmentPositions.length / 3;
          const seed = offset / 4 + 1;
          for (let corner = 0; corner < 4; corner++) {
            fragmentPositions.push(point.x, point.y, 0);
            fragmentData.push(
              (seed * 0.618034) % 1,
              (seed * 0.754878) % 1,
              (seed * 0.56984) % 1,
              (seed * 0.43829) % 1
            );
          }
          fragmentUvs.push(0, 0, 1, 0, 0, 1, 1, 1);
          fragmentIndices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
        }
        for (const z of [0, -0.6, -1.8, -5.4, -16.2, -48.6, -145.8]) {
          for (let i = 0; i < contour.length; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % contour.length];
            vertices.push(a.x, a.y, z, b.x, b.y, z);
          }
        }
        for (const point of path.getSpacedPoints(Math.max(4, Math.ceil(path.getLength() / 0.28)))) {
          vertices.push(point.x, point.y, 0, point.x, point.y, -10000);
        }
      }
    }
    const wire = new LineSegmentsGeometry().setPositions(vertices);
    const fragments = new BufferGeometry();
    fragments.setAttribute('position', new Float32BufferAttribute(fragmentPositions, 3));
    fragments.setAttribute('uv', new Float32BufferAttribute(fragmentUvs, 2));
    fragments.setAttribute('particle', new Float32BufferAttribute(fragmentData, 4));
    fragments.setIndex(fragmentIndices);
    return { face: new ShapeGeometry(shapes, 12), wire, fragments };
  });
}
