import type { World } from 'koota';
import type { WebGPURenderer } from 'three/webgpu';
import { Time } from '../time/traits.js';
import { ActiveScreen, NextScreen, Screen, ScreenTransition, Timeline } from '../timeline/traits.js';
import { stepShowreel } from './showreel/motion.js';
import { renderShowreel, updateShowreelPlayback } from './showreel/source.js';
import { Showreel } from './traits.js';

/** Step the video wall and compose its clips into one texture before the glass captures it. */
export function composeShowreel(world: World, renderer: WebGPURenderer) {
  const reel = world.queryFirst(Showreel)?.get(Showreel);
  if (!reel) return;
  const timeline = world.queryFirst(Timeline);
  const screen = timeline?.targetFor(ActiveScreen);
  const data = screen?.get(Screen);
  stepShowreel(reel.motion, {
    now: world.get(Time)!.elapsed,
    visible: !!data?.showreelVisible,
    focus: data?.showreelFocus ?? -1,
    duration: screen?.get(ScreenTransition)?.duration ?? 0,
    departureAt: data?.communityDeparture ? timeline!.get(Timeline)!.departureStartedAt : -1,
    looming: !!data?.communityRobotVisible && !data.robotFriendly && !data.communityDeparture,
    exitDelay: data?.robotFriendly ? data.robotJoinDelay : 0,
  });
  updateShowreelPlayback(
    reel.source,
    reel.motion,
    !!screen?.targetFor(NextScreen)?.get(Screen)?.showreelVisible
  );
  renderShowreel(reel.source, reel.motion, renderer);
  reel.opacity.value = reel.source.ready || reel.motion.blackout === 1 ? reel.motion.opacity : 0;
  reel.blackout.value = reel.motion.blackout;
}
