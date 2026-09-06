import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTrait, useWorld } from 'koota/react';
import { lerp } from 'math';
import { useLayoutEffect, useRef, useState } from 'react';
import { uniform } from 'three/tsl';
import { getRevealProgress, getTransitionProgress, Timeline } from '../sim/index.js';

/**
 * A shader opacity that follows screen timing, reversing unless a restart is requested.
 * Delayed opacities wait out the screen's reveal delay before they move.
 */
export function useTransitionOpacity(
  visible: boolean,
  { restartOnChange = false, delayed = false }: { restartOnChange?: boolean; delayed?: boolean } = {}
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
      const { from, target } = transition.current;
      if (opacity.value === target) return;
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = lerp(
        from,
        target,
        delayed ? getRevealProgress(world) : getTransitionProgress(world)
      );
    },
    { priority: -0.5 }
  );

  return opacity;
}
