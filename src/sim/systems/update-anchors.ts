import type { World } from 'koota';
import { Anchor, Bounds, Camera, Letter, ScreenTransition } from '../traits/index.js';

/** Align letter anchors on one baseline, with individual motion handled by floatBodies. */
export function updateAnchors(world: World) {
  const bounds = world.get(Bounds);
  if (!bounds || bounds.width === 0) return;

  const letters = world.query(Letter, Anchor);
  const count = letters.length;
  if (count === 0) return;

  // Frame the word for the closest front-facing screen so camera movement never respaces it
  const camera = world.queryFirst(Camera)?.get(Camera);
  const distance = world.query(ScreenTransition).reduce((closest, entity) => {
    const z = entity.get(ScreenTransition)!.cameraZ;
    return z > 0 ? Math.min(closest, z) : closest;
  }, Infinity);
  const width =
    camera && Number.isFinite(distance) && bounds.height > 0
      ? 2 * distance * Math.tan((camera.fov * Math.PI) / 360) * (bounds.width / bounds.height)
      : bounds.width;
  const spacing = Math.min(2.4, Math.max(0, width - 1.8) / Math.max(1, count - 1));

  letters.updateEach(([letter, anchor]) => {
    anchor.x = (letter.index - (count - 1) / 2) * spacing;
    anchor.y = 0;
    anchor.z = 0;
  });
}
