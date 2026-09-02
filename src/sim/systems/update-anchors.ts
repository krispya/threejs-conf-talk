import type { World } from 'koota';
import { Anchor, Bounds, Letter } from '../traits/index.js';

const MAX_SPACING = 2.4;
const MARGIN = 1.5;
const ROW_OFFSET = 0.9;

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

  const spacing = Math.min(MAX_SPACING, (bounds.width - MARGIN) / count);

  letters.updateEach(([letter, anchor]) => {
    anchor.x = (letter.index - (count - 1) / 2) * spacing;
    anchor.y = letter.index % 2 === 0 ? ROW_OFFSET : -ROW_OFFSET;
    anchor.z = 0;
  });
}
