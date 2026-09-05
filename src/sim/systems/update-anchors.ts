import type { World } from 'koota';
import { Anchor, Bounds, Camera, Letter, ScreenTransition } from '../traits/index.js';

const MAX_SPACING = 3.3;
const MARGIN = 2;
const ROW_OFFSET = 1.3;

/**
 * Lays the slots out left-to-right in Letter.index order and staggers them into two rows:
 *
 *   P      N      R
 *       M      D      S
 */
export function updateAnchors(world: World) {
  const bounds = world.get(Bounds);
  if (!bounds || bounds.width === 0) return;

  const letters = world.query(Letter, Anchor);
  const count = letters.length;
  if (count === 0) return;

  // Hold the closest front-facing screen's layout as the camera flies through the word
  const camera = world.queryFirst(Camera)?.get(Camera);
  const distance = world.query(ScreenTransition).reduce((closest, entity) => {
    const z = entity.get(ScreenTransition)!.cameraZ;
    return z > 0 ? Math.min(closest, z) : closest;
  }, Infinity);
  const minWidth =
    camera && Number.isFinite(distance) && bounds.height > 0
      ? 2 * distance * Math.tan((camera.fov * Math.PI) / 360) * (bounds.width / bounds.height)
      : 0;
  const spacing = Math.min(MAX_SPACING, (Math.max(bounds.width, minWidth) - MARGIN) / count);

  letters.updateEach(([letter, anchor]) => {
    anchor.x = (letter.index - (count - 1) / 2) * spacing;
    anchor.y = letter.index % 2 === 0 ? ROW_OFFSET : -ROW_OFFSET;
    anchor.z = 0;
  });
}
