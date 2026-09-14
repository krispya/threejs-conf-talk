import { cameraActions } from '../camera/actions.js';
import { packageActions } from '../package/actions.js';
import { profileActions } from '../profile/actions.js';
import { initiativeActions } from '../initiative/actions.js';
import { charterActions } from '../charter/actions.js';
import { letterActions } from '../letter/actions.js';
import { titleActions } from '../title/actions.js';
import { Position } from '../traits.js';
import {
  TransitionOrigin,
  ActiveScreen,
  FirstScreen,
  NextScreen,
  PreviousScreen,
  Screen,
  ScreenOf,
  OwnedByTimeline,
  ScreenTransition,
  Timeline,
} from './traits.js';
import { Time } from '../time/traits.js';
import { createActions, type Entity, type World } from 'koota';

import type { ScreenDefinition } from './screens.js';

export type Requirement = keyof ReturnType<typeof createTimelineBuilders>;

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
    cameraActions(world).setCameraTarget({ x: cameraX, y: cameraY, z: cameraZ });
    const data = screen.get(Screen)!;
    const {
      titleVisible,
      lettersVisible,
      profilesVisible,
      focusedProfile,
      surroundingProfiles,
      recedingProfiles,
      charterVisible,
      initiativesVisible,
    } = data;
    titleActions(world).setTitleVisible(titleVisible);
    letterActions(world).setLettersVisible(lettersVisible);
    packageActions(world).setPackagePresentation(data);
    profileActions(world).setProfilePresentation({
      profilesVisible,
      focusedProfile,
      surroundingProfiles,
      recedingProfiles,
      continuingDeparture,
      fromTeam,
    });
    charterActions(world).setCharterVisible(charterVisible);
    initiativeActions(world).setInitiativesVisible(initiativesVisible);
    timeline.add(ActiveScreen(screen));
  };

  const stopTimeline = (timeline: Entity) => {
    if (!timeline.isAlive() || !timeline.has(Timeline)) return;
    titleActions(world).setTitleVisible(false);
    letterActions(world).setLettersVisible(true);
    packageActions(world).setPackagesVisible(true);
    profileActions(world).setProfilesVisible(false);
    charterActions(world).setCharterVisible(false);
    initiativeActions(world).setInitiativesVisible(false);
    timeline.remove(ActiveScreen('*'));
    timeline.set(Timeline, { duration: 0, departureStartedAt: -1 });
  };

  return {
    createTimeline: (definitions: readonly ScreenDefinition[]) => {
      if (world.queryFirst(Timeline)) {
        throw new Error('Destroy the existing timeline before creating another');
      }
      const timeline = world.spawn(Timeline);
      const builders = createTimelineBuilders(world);
      const created = new Set<Requirement>();
      let previous: Entity | undefined;

      for (const { requires, transition, ...data } of definitions) {
        for (const requirement of requires) {
          if (created.has(requirement)) continue;
          for (const entity of builders[requirement]()) entity.add(OwnedByTimeline(timeline));
          created.add(requirement);
        }
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
    },
    startTimeline: (timeline: Entity) => {
      if (!timeline.isAlive() || !timeline.has(Timeline)) return;
      enter(timeline.targetFor(FirstScreen));
    },
    stopTimeline,
    destroyTimeline: (timeline: Entity) => {
      if (!timeline.isAlive() || !timeline.has(Timeline)) return;
      stopTimeline(timeline);
      timeline.destroy();
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
    goTo: (target: string | Entity) => {
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

function createTimelineBuilders(world: World) {
  return {
    camera: () => [cameraActions(world).createCamera()],
    title: () => [titleActions(world).createTitle()],
    charter: () => [charterActions(world).createCharter()],
    initiatives: initiativeActions(world).createInitiatives,
    letters: letterActions(world).createLetters,
    packages: packageActions(world).createPackages,
    profiles: profileActions(world).createProfiles,
  };
}
