import { clamp, lerp } from 'math';
import { easing } from 'math/time';

/** The portal's warning and the camera's reaction share one release time. */
export function portalFallMotion(elapsed: number, duration: number, delay: number) {
  const float = easing.cubicInOut(clamp(elapsed / 1.7, 0, 1));
  const recoil = easing.cubicOut(clamp((elapsed - (delay - 0.5)) / 0.3, 0, 1));
  const fall = clamp((elapsed - delay) / Math.max(0.001, duration - delay), 0, 1) ** 2;
  const charge = easing.cubicInOut(clamp((elapsed - (delay - 1.25)) / 0.75, 0, 1));
  const pulse = clamp((elapsed - (delay - 0.5)) / 0.65, 0, 1);
  const alarm = Math.sin(pulse * Math.PI);
  const opening = clamp((elapsed - 0.8) / 0.72, 0, 1);
  const burst = Math.sin(clamp((elapsed - 0.8) / 0.55, 0, 1) * Math.PI);
  return {
    progress: lerp(-0.028 * float - 0.038 * recoil, 1, fall),
    x: Math.sin(float * Math.PI * 0.55) * 1.4 * (1 - fall),
    y: (float * 4.5 + recoil * 1.4) * (1 - fall),
    bank: (float * 0.025 + recoil * 0.03) * (1 - fall) + Math.sin(fall * Math.PI) * 0.07,
    fov: -recoil * 2 * (1 - fall) + Math.sqrt(fall) * 16,
    // A damped spring lets the opening overshoot and recoil before the warning
    open:
      opening === 1
        ? 1
        : 1 - Math.exp(-opening * 7) * (Math.cos(opening * 12) + (7 / 12) * Math.sin(opening * 12)),
    burst,
    spin: (1 - (1 - opening) ** 4) * Math.PI * 1.4 + Math.max(0, elapsed - 0.8) * 0.35,
    radius: 1 - charge * 0.22 + recoil * 0.22 + alarm * 0.32,
    energy: 1 + burst * 2.4 + charge * (1 - recoil) * 0.7 + alarm * 2 + fall * 0.8,
    pulse,
    alarm,
  };
}
