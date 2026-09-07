import type { World } from 'koota';
import { lerp } from 'math';
import { getCameraProgress } from '../timeline.js';
import { portalFallMotion } from '../portal-fall.js';
import {
  ActiveScreen,
  Camera,
  Position,
  ScreenTransition,
  TargetPosition,
  Timeline,
  Time,
  TransitionOrigin,
} from '../traits/index.js';

export function moveCamera(world: World) {
  const timeline = world.queryFirst(Timeline);
  const screen = timeline?.targetFor(ActiveScreen);
  if (!screen) return;
  const alpha = getCameraProgress(world);
  const transition = screen.get(ScreenTransition)!;
  const timing = timeline!.get(Timeline)!;
  const float =
    transition.cameraEase === 'portalFall'
      ? portalFallMotion(
          world.get(Time)!.elapsed - timing.startedAt,
          timing.duration,
          transition.cameraDelay
        )
      : undefined;

  world
    .query(Camera, Position, TargetPosition, TransitionOrigin)
    .updateEach(([, position, target, origin]) => {
      position.x = lerp(origin.x, target.x, alpha) + (float?.x ?? 0);
      position.y = lerp(origin.y, target.y, alpha) + (float?.y ?? 0);
      position.z = lerp(origin.z, target.z, alpha);
    });
}
