import type { World } from 'koota';
import { lerp } from 'math';
import { getTransitionProgress } from '../timeline.js';
import {
  ActiveScreen,
  Camera,
  Position,
  TargetPosition,
  Timeline,
  TransitionOrigin,
} from '../traits/index.js';

export function moveCamera(world: World) {
  if (!world.queryFirst(Timeline)?.targetFor(ActiveScreen)) return;
  const alpha = getTransitionProgress(world);

  world
    .query(Camera, Position, TargetPosition, TransitionOrigin)
    .updateEach(([, position, target, origin]) => {
      position.x = lerp(origin.x, target.x, alpha);
      position.y = lerp(origin.y, target.y, alpha);
      position.z = lerp(origin.z, target.z, alpha);
    });
}
