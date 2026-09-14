import { createActions, type Entity } from 'koota';
import { easing } from 'math/time';
import { Time } from '../time/traits.js';
import { ActiveScreen, ScreenTransition, Timeline } from '../timeline/traits.js';
import { Transition } from './traits.js';

export type TransitionOptions = {
  restartOnChange?: boolean;
  restartKey?: string;
  delayed?: boolean;
  duration?: number;
  delay?: number;
  ease?: (progress: number) => number;
  ready?: boolean;
  clock?: 'timeline' | 'frames';
};

export const transitionActions = createActions((world) => ({
  createTransition: (
    value = 0,
    { ready = true, restartKey }: Pick<TransitionOptions, 'ready' | 'restartKey'> = {}
  ) => world.spawn(Transition({ value, from: value, target: value, ready, restartKey })),

  /** Capture timing once so subsequent frames need only the transition and the clock. */
  setTransition: (
    entity: Entity,
    target: number,
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
  ) => {
    if (!entity.isAlive()) return;
    const transition = entity.get(Transition);
    if (!transition) return;
    const timeline = world.queryFirst(Timeline);
    const timing = timeline?.get(Timeline);
    const now = world.get(Time)!.elapsed;
    const startedAt =
      ready && !transition.ready
        ? Math.max(timing?.startedAt ?? now, now)
        : (timing?.startedAt ?? now);
    const explicit =
      clock === 'frames' || duration !== undefined || startedAt > (timing?.startedAt ?? now);
    const revealDelay = delayed
      ? (timeline?.targetFor(ActiveScreen)?.get(ScreenTransition)?.revealDelay ?? 0)
      : 0;
    let value = transition.value;
    if (!ready) value = 0;
    else if (restartOnChange && transition.target !== target) value = 1 - target;
    else if (target === 1 && transition.restartKey !== restartKey) value = 0;

    entity.set(Transition, {
      value,
      from: value,
      target: ready ? target : 0,
      startedAt,
      duration: explicit
        ? Math.max(0.001, duration ?? timing?.duration ?? 0)
        : (timing?.duration ?? 0) <= 0
          ? 0
          : Math.max(0.001, timing!.duration - revealDelay),
      delay: explicit ? delay : revealDelay,
      ease: explicit ? ease : easing.cubicOut,
      elapsed: -1,
      clock,
      ready,
      restartKey,
    });
  },

  destroyTransition: (entity: Entity) => {
    if (entity.isAlive() && entity.has(Transition)) entity.destroy();
  },
}));
