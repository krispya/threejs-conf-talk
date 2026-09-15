import { useMutableCallback } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useActions, useQueryFirst, useTrait } from 'koota/react';
import { easing } from 'math/time';
import { useLayoutEffect, useRef, useMemo } from 'react';
import { uniform } from 'three/tsl';
import { Timeline } from '../timeline/traits.js';
import { transitionActions, type TransitionOptions } from './actions.js';
import { Transition } from './traits.js';

/**
 * Configure a world transition on discrete changes and hand its uniform to the world.
 * `syncTransitionUniforms` copies the advanced value into the uniform every frame.
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
  }: TransitionOptions = {}
) {
  const timeline = useQueryFirst(Timeline);
  const timing = useTrait(timeline, Timeline);
  const { createTransition, setTransition, destroyTransition, attachUniform } =
    useActions(transitionActions);
  const transition = useRef<Entity | undefined>(undefined);
  const opacity = useMemo(() => uniform(0), []);
  const opacityRef = useMutableCallback(opacity);

  useLayoutEffect(
    () => () => {
      if (transition.current) destroyTransition(transition.current);
      transition.current = undefined;
    },
    [destroyTransition]
  );

  useLayoutEffect(() => {
    if (!transition.current) {
      transition.current = createTransition(visible && ready ? 1 : 0, { ready, restartKey });
    }
    const entity = transition.current;
    attachUniform(entity, opacity);
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
    opacityRef.current.value = entity.get(Transition)!.value;
  }, [
    createTransition,
    setTransition,
    attachUniform,
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
    opacityRef,
  ]);

  return opacity;
}
