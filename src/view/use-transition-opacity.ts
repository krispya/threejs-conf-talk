import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useActions, useQueryFirst, useTrait } from 'koota/react';
import { easing } from 'math/time';
import { useLayoutEffect, useRef, useMemo } from 'react';
import { uniform } from 'three/tsl';
import { Timeline } from '../timeline/traits.js';
import { transitionActions, type TransitionOptions } from '../transition/actions.js';
import { Transition } from '../transition/traits.js';

/** Configure a world transition on discrete changes and project its value into a shader uniform. */
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
  }: TransitionOptions = {}
) {
  const timeline = useQueryFirst(Timeline);
  const timing = useTrait(timeline, Timeline);
  const { createTransition, setTransition, destroyTransition } = useActions(transitionActions);
  const transition = useRef<Entity | undefined>(undefined);
  const opacity = useMemo(() => uniform(0), []);

  useLayoutEffect(
    () => () => {
      if (transition.current) destroyTransition(transition.current);
      transition.current = undefined;
    },
    [destroyTransition]
  );

  useLayoutEffect(() => {
    const entity = (transition.current ??= createTransition(visible && ready ? 1 : 0, {
      ready,
      restartKey,
    }));
    setTransition(entity, Number(visible), {
      restartOnChange,
      restartKey,
      delayed,
      duration,
      delay,
      ease,
      ready,
      clock,
    });
    // Reset readiness and restart values before the next draw.
    // oxlint-disable-next-line react/immutability
    opacity.value = entity.get(Transition)!.value;
  }, [
    createTransition,
    setTransition,
    visible,
    timing,
    restartOnChange,
    restartKey,
    delayed,
    duration,
    delay,
    ease,
    ready,
    clock,
    opacity,
  ]);

  useFrame(
    () => {
      const entity = transition.current;
      if (!entity?.isAlive()) return;
      // TSL uniforms carry mutable render state outside React.
      // oxlint-disable-next-line react/immutability
      opacity.value = entity.get(Transition)!.value;
    },
    { priority: -0.5 }
  );

  return opacity;
}
