import { clamp } from 'math';

/**
 * Arrival curve for a portrait joining, leaving or receding from the ring.
 *
 * Portraits set off one after another around the ring and settle with a soft overshoot, so
 * the group gathers rather than snapping into place as a block. `progress` is linear across
 * the screen's reveal window, `order` is the portrait's slot and `count` how many share the
 * ring. The centered portrait leads.
 */
export function profileArrival(progress: number, order: number, count: number) {
  const lead = count > 1 ? (Math.max(0, order) / (count - 1)) * 0.45 : 0;
  // The last portrait sets off at 0.45 and settles by 0.95, so the ring reads as a run
  // around the circle and has finished before the reveal window closes
  const t = clamp((progress - lead) / 0.5, 0, 1);
  if (t >= 1) return 1;
  // A damped spring, settling about seven percent past its mark before easing back
  return 1 - Math.exp(-6 * t) * (Math.cos(7 * t) + (6 / 7) * Math.sin(7 * t));
}
