import type { World } from 'koota';
import { lerp } from 'math';
import { getTransitionProgress } from '../timeline.js';
import { ActiveScreen, Package, Size, SizeTransition, Timeline } from '../traits/index.js';

/** Resize the same package entities using the destination screen's transition timing. */
export function resizePackages(world: World) {
  if (!world.queryFirst(Timeline)?.targetFor(ActiveScreen)) return;
  const progress = getTransitionProgress(world);

  world.query(Package, Size, SizeTransition).updateEach(([, size, transition]) => {
    size.radius = lerp(transition.from, transition.to, progress);
  });
}
