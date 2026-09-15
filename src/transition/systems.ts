import type { World } from 'koota';
import { clamp, lerp } from 'math';
import { Time } from '../time/traits.js';
import { Transition, TransitionUniform } from './traits.js';

export function advanceTransitions(world: World) {
  const time = world.get(Time)!;
  world.query(Transition).updateEach(([transition]) => {
    if (transition.value === transition.target) return;
    // Count presented frames so a first-draw stall cannot skip the entrance.
    if (transition.clock === 'frames') {
      transition.elapsed =
        transition.elapsed < 0 ? 0 : transition.elapsed + Math.min(time.delta, 1 / 30);
    }
    const elapsed =
      transition.clock === 'frames' ? transition.elapsed : time.elapsed - transition.startedAt;
    const progress =
      transition.duration <= 0 ? 1 : clamp((elapsed - transition.delay) / transition.duration, 0, 1);
    transition.value = lerp(transition.from, transition.target, transition.ease(progress));
  });
}

/** Copy each advanced transition into the uniform its materials sample. */
export function syncTransitionUniforms(world: World) {
  world.query(Transition, TransitionUniform).updateEach(([transition, node]) => {
    node.value = transition.value;
  });
}
