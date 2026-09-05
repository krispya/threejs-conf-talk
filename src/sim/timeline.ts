import { createActions } from 'koota';
import { intro } from './screens/intro.js';
import { letters } from './screens/letters.js';
import { Timeline } from './traits/index.js';

export const screens = [intro, letters] as const;
export type ScreenId = (typeof screens)[number]['id'];

export const timelineActions = createActions((world) => {
  let cleanup: (() => void) | void;

  const transition = (index: number) => {
    const screen = screens[index];
    if (!screen || world.get(Timeline)!.index === index) return;

    cleanup?.();
    world.set(Timeline, { index });
    cleanup = screen.actions(world).enter();
  };

  return {
    start: () => transition(0),
    stop: () => {
      cleanup?.();
      cleanup = undefined;
      world.set(Timeline, { index: -1 });
    },
    next: () => {
      const { index } = world.get(Timeline)!;
      if (index >= 0) transition(index + 1);
    },
    previous: () => {
      const { index } = world.get(Timeline)!;
      if (index >= 0) transition(index - 1);
    },
    goTo: (id: ScreenId) => transition(screens.findIndex((screen) => screen.id === id)),
  };
});
