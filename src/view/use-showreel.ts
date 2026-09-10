import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { useEffect, useState } from 'react';
import { uniform } from 'three/tsl';
import { ActiveScreen, NextScreen, Screen, ScreenTransition, Time, Timeline } from '../sim/index.js';
import { createShowreelMotion, stepShowreel } from './showreel-motion.js';
import {
  createShowreelSource,
  disposeShowreel,
  mountShowreel,
  renderShowreel,
  updateShowreelPlayback,
} from './showreel-source.js';

export function useShowreel() {
  const world = useWorld();
  const [reel] = useState(() => ({
    source: createShowreelSource(),
    motion: createShowreelMotion(),
    opacity: uniform(0),
    blackout: uniform(0),
  }));
  useEffect(() => {
    mountShowreel(reel.source);
    return () => disposeShowreel(reel.source);
  }, [reel]);

  useFrame(
    (state) => {
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
      renderShowreel(reel.source, reel.motion, state.renderer);
      // Shader uniforms are mutable render state, separate from React's component state.
      /* oxlint-disable react/immutability */
      reel.opacity.value = reel.source.ready || reel.motion.blackout === 1 ? reel.motion.opacity : 0;
      reel.blackout.value = reel.motion.blackout;
      /* oxlint-enable react/immutability */
    },
    { priority: -0.8 }
  );
  return reel;
}
