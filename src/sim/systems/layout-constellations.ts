import type { World } from 'koota';
import { lerp } from 'math';
import { getTransitionProgress } from '../timeline.js';
import {
  Anchor,
  ConstellationExpansion,
  ConstellationLayout,
  ConstellationMember,
} from '../traits/index.js';

/** Spread stars into their map layout using the same timing as the camera. */
export function layoutConstellations(world: World) {
  const progress = getTransitionProgress(world);
  world.query(ConstellationExpansion).updateEach(([expansion], constellation) => {
    expansion.value = lerp(expansion.from, expansion.to, progress);
    world
      .query(Anchor, ConstellationLayout, ConstellationMember(constellation))
      .updateEach(([anchor, layout]) => {
        anchor.x = lerp(layout.compactX, layout.mapX, expansion.value);
        anchor.y = lerp(layout.compactY, layout.mapY, expansion.value);
        anchor.z = lerp(layout.compactZ, layout.mapZ, expansion.value);
      });
  });
}
