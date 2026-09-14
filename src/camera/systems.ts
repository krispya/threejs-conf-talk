import { Bounds, TargetPosition, Camera } from './traits.js';
import { Position } from '../traits.js';
import { TransitionOrigin, ActiveScreen, ScreenTransition, Timeline } from '../timeline/traits.js';
import { Time } from '../time/traits.js';
import type { World } from 'koota';
import { lerp } from 'math';
import { getCameraProgress } from '../timeline/timing.js';
import { portalFallMotion } from '../initiative/utils/portal-motion.js';

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

export function updateBounds(world: World, viewport: { width: number; height: number }) {
  world.set(Bounds, { width: viewport.width, height: viewport.height });
}
