import { Time } from '../time/traits.js';
import type { World } from 'koota';
import { clamp } from 'math';
import { easing } from 'math/time';
import { portalFallMotion } from '../initiative/utils/portal-motion.js';
import { ActiveScreen, ScreenTransition, Timeline } from './traits.js';

export function getTransitionProgress(world: World) {
  const timing = world.queryFirst(Timeline)?.get(Timeline);
  if (!timing || timing.duration <= 0) return 1;

  const progress = clamp((world.get(Time)!.elapsed - timing.startedAt) / timing.duration, 0, 1);
  return easing.cubicOut(progress);
}

/**
 * Linear progress across a screen's reveal window, which starts after the reveal delay.
 * For views that bring their own curve.
 */
export function getRevealTime(world: World) {
  const timeline = world.queryFirst(Timeline);
  const timing = timeline?.get(Timeline);
  if (!timeline || !timing || timing.duration <= 0) return 1;

  const delay = timeline.targetFor(ActiveScreen)?.get(ScreenTransition)?.revealDelay ?? 0;
  const elapsed = world.get(Time)!.elapsed - timing.startedAt - delay;
  return clamp(elapsed / Math.max(0.001, timing.duration - delay), 0, 1);
}

/** Views that opt in can hold until the screen's reveal delay, then ease in over the rest. */
export function getRevealProgress(world: World) {
  return easing.cubicOut(getRevealTime(world));
}

/** Camera timing can hold at the origin for a beat and then ease out over the remaining time. */
export function getCameraProgress(world: World) {
  const timeline = world.queryFirst(Timeline);
  const timing = timeline?.get(Timeline);
  if (!timeline || !timing || timing.duration <= 0) return 1;

  const transition = timeline.targetFor(ActiveScreen)?.get(ScreenTransition);
  const delay = transition?.cameraDelay ?? 0;
  if (transition?.cameraEase === 'portalFall') {
    return portalFallMotion(world.get(Time)!.elapsed - timing.startedAt, timing.duration, delay)
      .progress;
  }
  if (delay <= 0 && !transition?.cameraDuration && transition?.cameraEase === 'auto')
    return getTransitionProgress(world);
  if (world.get(Time)!.elapsed <= timing.startedAt + delay) return 0;
  const elapsed = world.get(Time)!.elapsed - timing.startedAt - delay;
  const progress = clamp(
    elapsed / Math.max(0.001, transition?.cameraDuration || timing.duration - delay),
    0,
    1
  );
  if (transition?.cameraEase === 'cubicIn') return easing.cubicIn(progress);
  if (transition?.cameraEase === 'cubicInOut') return easing.cubicInOut(progress);
  // A held camera builds slowly, jumps to speed like a warp drive, and glides in at the end
  return easing.expoInOut(progress);
}
