import { createActions, type Entity, type World } from 'koota';
import { clamp } from 'math';
import { easing } from 'math/time';
import { screens, type ScreenId } from './screens.js';
import {
  ActiveScreen,
  Camera,
  FirstScreen,
  Hidden,
  NextScreen,
  Package,
  Position,
  PreviousScreen,
  Screen,
  ScreenOf,
  ScreenTransition,
  TargetPosition,
  Time,
  Timeline,
  TransitionOrigin,
} from './traits/index.js';

function createTimeline(world: World) {
  const timeline = world.spawn(Timeline);
  let previous: Entity | undefined;

  for (const { id, packagesVisible, transition } of screens) {
    const screen = world.spawn(
      Screen({ id, packagesVisible }),
      ScreenTransition(transition),
      ScreenOf(timeline)
    );

    if (previous) {
      previous.add(NextScreen(screen));
      screen.add(PreviousScreen(previous));
    } else {
      timeline.add(FirstScreen(screen));
    }
    previous = screen;
  }

  return timeline;
}

export const timelineActions = createActions((world) => {
  const enter = (screen: Entity | undefined) => {
    const timeline = world.queryFirst(Timeline);
    if (!timeline || !screen || !screen.has(ScreenOf(timeline))) return;
    if (timeline.targetFor(ActiveScreen) === screen) return;

    world.query(Position, TransitionOrigin).updateEach(([position, origin]) => {
      origin.x = position.x;
      origin.y = position.y;
      origin.z = position.z;
    });

    const { duration, cameraX, cameraY, cameraZ } = screen.get(ScreenTransition)!;
    timeline.set(Timeline, {
      startedAt: world.get(Time)!.elapsed,
      duration,
    });
    for (const camera of world.query(Camera, TargetPosition)) {
      camera.set(TargetPosition, { x: cameraX, y: cameraY, z: cameraZ });
    }
    const { packagesVisible } = screen.get(Screen)!;
    for (const entity of world.query(Package)) {
      if (packagesVisible) entity.remove(Hidden);
      else entity.add(Hidden);
    }
    timeline.add(ActiveScreen(screen));
  };

  return {
    start: () => {
      const timeline = world.queryFirst(Timeline) ?? createTimeline(world);
      enter(timeline.targetFor(FirstScreen));
      return timeline;
    },
    stop: () => {
      for (const entity of world.query(Package, Hidden)) entity.remove(Hidden);
      const timeline = world.queryFirst(Timeline);
      timeline?.remove(ActiveScreen('*'));
      timeline?.set(Timeline, { duration: 0 });
    },
    next: () => {
      const screen = world.queryFirst(Timeline)?.targetFor(ActiveScreen);
      enter(screen?.targetFor(NextScreen));
    },
    previous: () => {
      const screen = world.queryFirst(Timeline)?.targetFor(ActiveScreen);
      enter(screen?.targetFor(PreviousScreen));
    },
    goTo: (target: ScreenId | Entity) => {
      const timeline = world.queryFirst(Timeline);
      if (!timeline) return;
      const screen =
        typeof target === 'string'
          ? world
              .query(Screen, ScreenOf(timeline))
              .find((entity) => entity.get(Screen)!.id === target)
          : target;
      enter(screen);
    },
  };
});

export function getTransitionProgress(world: World) {
  const timing = world.queryFirst(Timeline)?.get(Timeline);
  if (!timing || timing.duration <= 0) return 1;

  const progress = clamp((world.get(Time)!.elapsed - timing.startedAt) / timing.duration, 0, 1);
  return easing.cubicOut(progress);
}
