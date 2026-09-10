import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { showreelDissolve, showreelHero } from '../data/showreel.js';

export function createShowreelMotion() {
  return {
    visible: false,
    focus: -1,
    tile: showreelHero,
    opacity: 0,
    opacityFrom: 0,
    fadeAt: 0,
    fadeDelay: 0,
    zoom: 1,
    zoomFrom: 1,
    zoomAt: 0,
    zoomDelay: 0,
    zoomDuration: 3.2,
    cutAt: Infinity,
    cut: false,
    blackout: 0,
    blackoutFrom: 0,
    blackoutAt: 0,
    departureAt: -1,
    looming: false,
    reset: 0,
  };
}

export type ShowreelMotion = ReturnType<typeof createShowreelMotion>;

/** One presentation clock drives the video composition, its fades, and playback selection. */
export function stepShowreel(
  motion: ShowreelMotion,
  input: {
    now: number;
    visible: boolean;
    focus: number;
    duration: number;
    departureAt: number;
    looming: boolean;
    exitDelay: number;
  }
) {
  const { now, visible, focus } = input;
  const entering = visible && !motion.visible;
  if (visible !== motion.visible) {
    motion.opacityFrom = motion.opacity;
    motion.fadeAt = now;
    motion.fadeDelay = visible ? 0 : input.exitDelay;
  }
  if (visible && (entering || focus !== motion.focus)) {
    motion.zoomFrom = entering && motion.opacity === 0 ? (focus < 0 ? 1 : 0) : motion.zoom;
    motion.zoomAt = now;
    motion.zoomDelay = focus < 0 ? showreelDissolve + 1.2 : 0;
    motion.zoomDuration = focus < 0 ? 3.2 : 2.4;
    motion.tile = focus < 0 ? showreelHero : focus;
    motion.cutAt = focus < 0 ? Infinity : now + Math.max(2.4, input.duration);
    motion.cut = false;
    if (entering && focus < 0) motion.reset++;
  }
  if (
    visible &&
    (input.departureAt !== motion.departureAt || input.looming !== motion.looming || entering)
  ) {
    motion.blackoutFrom = motion.blackout;
    motion.blackoutAt = now;
  }
  motion.visible = visible;
  motion.focus = focus;
  motion.departureAt = input.departureAt;
  motion.looming = input.looming;
  motion.opacity = lerp(
    motion.opacityFrom,
    Number(visible),
    easing.cubicIn(clamp((now - motion.fadeAt - motion.fadeDelay) / showreelDissolve, 0, 1))
  );
  if (visible) {
    motion.zoom = lerp(
      motion.zoomFrom,
      focus < 0 ? 0 : 1,
      easing.quintInOut(clamp((now - motion.zoomAt - motion.zoomDelay) / motion.zoomDuration, 0, 1))
    );
    motion.cut = now >= motion.cutAt;
    const blackout = input.looming
      ? 1
      : input.departureAt >= 0
        ? easing.cubicInOut(clamp((now - input.departureAt - 1.5) / 6, 0, 1))
        : 0;
    motion.blackout = lerp(
      motion.blackoutFrom,
      blackout,
      easing.cubicOut(clamp((now - motion.blackoutAt) / 0.65, 0, 1))
    );
  }
  return motion;
}

/** Center-crop a video without stretching it, matching object-fit: cover. */
export function coverVideo(out: { x: number; y: number }, videoAspect: number, frameAspect: number) {
  out.x = Math.min(1, frameAspect / videoAspect);
  out.y = Math.min(1, videoAspect / frameAspect);
  return out;
}
