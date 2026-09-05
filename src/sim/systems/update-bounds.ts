import type { World } from 'koota';
import { Bounds } from '../traits/index.js';

export function updateBounds(world: World, viewport: { width: number; height: number }) {
  world.set(Bounds, { width: viewport.width, height: viewport.height });
}
