import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useRef, useState } from 'react';
import { uniform } from 'three/tsl';
import { getRevealProgress, getTransitionProgress, Time, Timeline } from '../sim/index.js';

/**
 * A shader opacity that follows screen timing, reversing unless a restart is requested.
 * Delayed opacities wait out the screen's reveal delay before they move.
 */
export function useTransitionOpacity(
  visible: boolean,
  {
    restartOnChange = false,
    delayed = false,
    duration,
    delay = 0,
  }: { restartOnChange?: boolean; delayed?: boolean; duration?: number; delay?: number } = {}
) {
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const timing = useTrait(timeline, Timeline);
  const [opacity] = useState(() => uniform(visible ? 1 : 0));
  const transition = useRef({ from: visible ? 1 : 0, target: visible ? 1 : 0 });

  useLayoutEffect(() => {
    if (restartOnChange && transition.current.target !== Number(visible)) {
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = visible ? 0 : 1;
    }
    transition.current = { from: opacity.value, target: visible ? 1 : 0 };
  }, [visible, timing, opacity, restartOnChange]);

  useFrame(
    () => {
      // Auto-advance can change the timeline before React commits the next screen
      if (world.queryFirst(Timeline)?.get(Timeline)?.startedAt !== timing?.startedAt) return;
      const { from, target } = transition.current;
      if (opacity.value === target) return;
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = lerp(
        from,
        target,
        duration !== undefined
          ? easing.cubicOut(
              clamp(
                (world.get(Time)!.elapsed - (timing?.startedAt ?? 0) - delay) /
                  Math.max(0.001, duration),
                0,
                1
              )
            )
          : delayed
            ? getRevealProgress(world)
            : getTransitionProgress(world)
      );
    },
    { priority: -0.5 }
  );

  return opacity;
}
