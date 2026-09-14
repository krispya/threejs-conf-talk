import { cameraActions } from '../camera/actions.js';
import { Time } from '../time/traits.js';
import { timelineActions } from './actions.js';
import { type World } from 'koota';

import { ActiveScreen, Screen, Timeline } from './traits.js';

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
    cameraActions(world).finishCameraTransition();
    timelineActions(world).next();
  }
}
