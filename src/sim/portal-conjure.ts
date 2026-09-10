import { clamp, lerp } from 'math';
import { easing } from 'math/time';

/**
 * How the stone portal conjures an initiative's footage once the glade is reached.
 * Light gathers at the center, the opening springs to size, and the footage blooms outward
 * behind a front of energy while the rim flares and settles to a slow breath.
 */
export function portalConjureMotion(elapsed: number) {
  const gather = easing.cubicInOut(clamp((elapsed - 0.15) / 0.55, 0, 1));
  const opening = clamp((elapsed - 0.55) / 0.9, 0, 1);
  const burst = Math.sin(clamp((elapsed - 0.55) / 0.9, 0, 1) * Math.PI);
  return {
    // A damped spring lets the opening overshoot before it settles on the stones
    open:
      opening === 1
        ? 1
        : 1 - Math.exp(-opening * 6) * (Math.cos(opening * 11) + (6 / 11) * Math.sin(opening * 11)),
    reveal: easing.cubicOut(clamp((elapsed - 1.05) / 1.2, 0, 1)),
    energy: 1 + gather * 0.8 + burst * 2.2,
  };
}

/** The stone ring emerges first, with the glade and sky following through the crossing. */
export function portalArrivalLighting(
  elapsed: number,
  falling: boolean,
  duration: number,
  delay: number
) {
  if (falling) {
    const descent = clamp((elapsed - delay) / Math.max(0.001, duration - delay), 0, 1);
    return {
      portal: easing.cubicInOut(clamp((descent - 0.08) / 0.77, 0, 1)) * 0.75,
      environment: easing.cubicInOut(clamp((descent - 0.55) / 0.45, 0, 1)) * 0.2,
      sky: easing.cubicInOut(clamp((descent - 0.72) / 0.28, 0, 1)) * 0.12,
    };
  }
  return {
    portal: lerp(0.75, 1, easing.cubicOut(clamp(elapsed / 0.8, 0, 1))),
    environment: lerp(0.2, 1, easing.cubicInOut(clamp(elapsed / 1.6, 0, 1))),
    sky: lerp(0.12, 1, easing.cubicInOut(clamp(elapsed / 2.2, 0, 1))),
  };
}
