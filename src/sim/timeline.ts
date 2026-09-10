import { createActions, type Entity, type World } from 'koota';
import { clamp } from 'math';
import { easing } from 'math/time';
import { screens, type ScreenId } from './screens.js';
import { portalFallMotion } from './portal-fall.js';
import {
  ActiveScreen,
  Camera,
  Charter,
  FirstScreen,
  Hidden,
  Initiative,
  Letter,
  NextScreen,
  Package,
  PackageSizing,
  Position,
  PreviousScreen,
  Profile,
  ProfileFocus,
  Screen,
  ScreenOf,
  ScreenTransition,
  Size,
  SizeTransition,
  TargetPosition,
  Time,
  Timeline,
  Title,
  TransitionOrigin,
} from './traits/index.js';

function createTimeline(world: World) {
  const timeline = world.spawn(Timeline);
  let previous: Entity | undefined;

  for (const { transition, ...data } of screens) {
    const screen = world.spawn(Screen(data), ScreenTransition(transition), ScreenOf(timeline));

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
    const fromTeam = timeline.targetFor(ActiveScreen)?.get(Screen)?.teamVisible ?? false;
    const continuingDeparture =
      timeline.targetFor(ActiveScreen)?.get(Screen)?.id === 'community-growth' &&
      screen.get(Screen)?.id === 'community-robot';

    world.query(Position, TransitionOrigin).updateEach(([position, origin]) => {
      origin.x = position.x;
      origin.y = position.y;
      origin.z = position.z;
    });

    const { duration, cameraX, cameraY, cameraZ } = screen.get(ScreenTransition)!;
    timeline.set(Timeline, {
      startedAt: world.get(Time)!.elapsed,
      duration,
      departureStartedAt: screen.get(Screen)?.communityDeparture
        ? continuingDeparture
          ? timeline.get(Timeline)!.departureStartedAt
          : world.get(Time)!.elapsed
        : -1,
    });
    for (const camera of world.query(Camera, TargetPosition)) {
      camera.set(TargetPosition, { x: cameraX, y: cameraY, z: cameraZ });
    }
    const {
      titleVisible,
      lettersVisible,
      packagesVisible,
      packageNames,
      profilesVisible,
      focusedProfile,
      surroundingProfiles,
      recedingProfiles,
      packageSizing,
      charterVisible,
      initiativesVisible,
    } = screen.get(Screen)!;
    for (const entity of world.query(Title)) {
      if (titleVisible) entity.remove(Hidden);
      else entity.add(Hidden);
    }
    world.query(PackageSizing, Size, SizeTransition).updateEach(([sizing, size, transition]) => {
      transition.from = size.radius;
      transition.to = sizing[packageSizing];
    });
    for (const entity of world.query(Letter)) {
      if (lettersVisible) entity.remove(Hidden);
      else entity.add(Hidden);
    }
    for (const entity of world.query(Package)) {
      if (
        packagesVisible &&
        (packageNames.length === 0 || packageNames.includes(entity.get(Package)!.name))
      )
        entity.remove(Hidden);
      else entity.add(Hidden);
    }
    for (const entity of world.query(Profile)) {
      const login = entity.get(Profile)!.login;
      const focused = focusedProfile === login;
      const slot = surroundingProfiles.indexOf(login);
      // Portraits that already told their story keep their ring and drop behind the
      // ones arriving in front
      const receded = recedingProfiles.includes(login);
      const held = focused || slot >= 0 || receded;
      const focus = entity.get(ProfileFocus);
      if (focus) {
        entity.set(ProfileFocus, {
          from: focus.value,
          to: held ? 1 : 0,
          slot: focused ? -1 : slot >= 0 ? slot : focus.slot,
          count: slot >= 0 ? surroundingProfiles.length : focus.count,
          recedeFrom: focus.recede,
          recedeTo: receded ? 1 : 0,
          wanderFromX: continuingDeparture ? focus.wanderFromX : focus.wanderX,
          wanderFromY: continuingDeparture ? focus.wanderFromY : focus.wanderY,
          wanderFromOpacity: continuingDeparture ? focus.wanderFromOpacity : focus.wanderOpacity,
          scaleFrom: focus.scale,
          fromTeam,
        });
      }
      // A screen that names no portraits shows everyone, otherwise only the named ones
      const everyone =
        !focusedProfile && surroundingProfiles.length === 0 && recedingProfiles.length === 0;
      if (profilesVisible && (everyone || held)) entity.remove(Hidden);
      else entity.add(Hidden);
    }
    for (const entity of world.query(Charter)) {
      if (charterVisible) entity.remove(Hidden);
      else entity.add(Hidden);
    }
    for (const entity of world.query(Initiative)) {
      if (initiativesVisible) entity.remove(Hidden);
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
      for (const entity of world.query(Title)) entity.add(Hidden);
      for (const entity of world.query(Letter, Hidden)) entity.remove(Hidden);
      for (const entity of world.query(Package, Hidden)) entity.remove(Hidden);
      for (const entity of world.query(Profile)) entity.add(Hidden);
      for (const entity of world.query(Charter)) entity.add(Hidden);
      for (const entity of world.query(Initiative)) entity.add(Hidden);
      const timeline = world.queryFirst(Timeline);
      timeline?.remove(ActiveScreen('*'));
      timeline?.set(Timeline, { duration: 0, departureStartedAt: -1 });
    },
    next: () => {
      const screen = world.queryFirst(Timeline)?.targetFor(ActiveScreen);
      enter(screen?.targetFor(NextScreen));
    },
    previous: () => {
      const screen = world.queryFirst(Timeline)?.targetFor(ActiveScreen);
      let previous = screen?.targetFor(PreviousScreen);
      while (previous?.get(Screen)?.autoAdvance) previous = previous.targetFor(PreviousScreen);
      enter(previous);
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

/** Transition screens hand off to their destination after the visual sequence finishes. */
export function advanceTimeline(world: World) {
  const timeline = world.queryFirst(Timeline);
  const screen = timeline?.targetFor(ActiveScreen);
  const timing = timeline?.get(Timeline);
  if (
    screen?.get(Screen)?.autoAdvance &&
    timing &&
    world.get(Time)!.elapsed - timing.startedAt >= timing.duration
  ) {
    world.query(Camera, Position, TargetPosition).updateEach(([, position, target]) => {
      position.x = target.x;
      position.y = target.y;
      position.z = target.z;
    });
    timelineActions(world).next();
  }
}

export function getTransitionProgress(world: World) {
  const timing = world.queryFirst(Timeline)?.get(Timeline);
  if (!timing || timing.duration <= 0) return 1;

  const progress = clamp((world.get(Time)!.elapsed - timing.startedAt) / timing.duration, 0, 1);
  return easing.cubicOut(progress);
}

/**
 * Linear progress across a screen's reveal window, which starts after the reveal delay.
 * For views that bring their own curve.
 */
export function getRevealTime(world: World) {
  const timeline = world.queryFirst(Timeline);
  const timing = timeline?.get(Timeline);
  if (!timeline || !timing || timing.duration <= 0) return 1;

  const delay = timeline.targetFor(ActiveScreen)?.get(ScreenTransition)?.revealDelay ?? 0;
  const elapsed = world.get(Time)!.elapsed - timing.startedAt - delay;
  return clamp(elapsed / Math.max(0.001, timing.duration - delay), 0, 1);
}

/** Views that opt in can hold until the screen's reveal delay, then ease in over the rest. */
export function getRevealProgress(world: World) {
  return easing.cubicOut(getRevealTime(world));
}

/** Camera timing can hold at the origin for a beat and then ease out over the remaining time. */
export function getCameraProgress(world: World) {
  const timeline = world.queryFirst(Timeline);
  const timing = timeline?.get(Timeline);
  if (!timeline || !timing || timing.duration <= 0) return 1;

  const transition = timeline.targetFor(ActiveScreen)?.get(ScreenTransition);
  const delay = transition?.cameraDelay ?? 0;
  if (transition?.cameraEase === 'portalFall') {
    return portalFallMotion(world.get(Time)!.elapsed - timing.startedAt, timing.duration, delay)
      .progress;
  }
  if (delay <= 0 && !transition?.cameraDuration && transition?.cameraEase === 'auto')
    return getTransitionProgress(world);
  if (world.get(Time)!.elapsed <= timing.startedAt + delay) return 0;
  const elapsed = world.get(Time)!.elapsed - timing.startedAt - delay;
  const progress = clamp(
    elapsed / Math.max(0.001, transition?.cameraDuration || timing.duration - delay),
    0,
    1
  );
  if (transition?.cameraEase === 'cubicIn') return easing.cubicIn(progress);
  if (transition?.cameraEase === 'cubicInOut') return easing.cubicInOut(progress);
  // A held camera builds slowly, jumps to speed like a warp drive, and glides in at the end
  return easing.expoInOut(progress);
}
