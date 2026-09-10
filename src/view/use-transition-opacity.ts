import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useRef, useState } from 'react';
import { uniform } from 'three/tsl';
import { getRevealProgress, getTransitionProgress, Time, Timeline } from '../sim/index.js';

/**
 * A shader opacity that follows screen timing, reversing unless a restart is requested.
 * A new restart key replays the entrance when visible content changes.
 * Delayed opacities wait out the screen's reveal delay before they move.
 * Readiness gates start a full fade once preparation finishes.
 * The frame clock preserves the fade across rendering stalls instead of catching up to the timeline.
 */
export function useTransitionOpacity(
  visible: boolean,
  {
    restartOnChange = false,
    restartKey,
    delayed = false,
    duration,
    delay = 0,
    ease = easing.cubicOut,
    ready = true,
    clock = 'timeline',
  }: {
    restartOnChange?: boolean;
    restartKey?: string;
    delayed?: boolean;
    duration?: number;
    delay?: number;
    ease?: (progress: number) => number;
    ready?: boolean;
    clock?: 'timeline' | 'frames';
  } = {}
) {
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const timing = useTrait(timeline, Timeline);
  const [opacity] = useState(() => uniform(visible && ready ? 1 : 0));
  const transition = useRef({
    from: visible && ready ? 1 : 0,
    target: visible && ready ? 1 : 0,
    ready,
    restartKey,
    startedAt: timing?.startedAt ?? 0,
    elapsed: -1,
  });

  useLayoutEffect(() => {
    if (!ready) {
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = 0;
    } else if (
      (restartOnChange && transition.current.target !== Number(visible)) ||
      (visible && transition.current.restartKey !== restartKey)
    ) {
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = visible ? 0 : 1;
    }
    transition.current = {
      from: opacity.value,
      target: visible && ready ? 1 : 0,
      startedAt:
        ready && !transition.current.ready
          ? Math.max(timing?.startedAt ?? 0, world.get(Time)!.elapsed)
          : (timing?.startedAt ?? 0),
      ready,
      restartKey,
      elapsed: -1,
    };
  }, [visible, timing, opacity, restartOnChange, restartKey, ready, world, clock]);

  useFrame(
    (_, delta) => {
      // Auto-advance can change the timeline before React commits the next screen
      if (world.queryFirst(Timeline)?.get(Timeline)?.startedAt !== timing?.startedAt) return;
      const { from, target, startedAt } = transition.current;
      if (opacity.value === target) return;
      // A presentation fade counts visible frames so first-draw stalls cannot skip its start.
      if (clock === 'frames') {
        transition.current.elapsed =
          transition.current.elapsed < 0 ? 0 : transition.current.elapsed + Math.min(delta, 1 / 30);
      }
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      opacity.value = lerp(
        from,
        target,
        clock === 'frames' || duration !== undefined || startedAt > (timing?.startedAt ?? 0)
          ? ease(
              clamp(
                ((clock === 'frames'
                  ? transition.current.elapsed
                  : world.get(Time)!.elapsed - startedAt) -
                  delay) /
                  Math.max(0.001, duration ?? timing?.duration ?? 0),
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
