import { IsHidden, Position, Rotation } from '../traits.js';
import { Transition } from '../transition/traits.js';
import { Ref, TransitionUniform } from './traits.js';
import { Not, type World } from 'koota';

/** Projects the data model onto the Three objects owned by the view. */
export function syncTransforms(world: World) {
  world.query(Position, Rotation, Ref, Not(IsHidden)).updateEach(([position, rotation, object]) => {
    object.position.set(position.x, position.y, position.z);
    object.rotation.set(rotation.x, rotation.y, rotation.z);
  });
}

/** Copies every advanced transition into the uniform its materials sample. */
export function syncTransitionUniforms(world: World) {
  world.query(Transition, TransitionUniform).updateEach(([transition, node]) => {
    node.value = transition.value;
  });
}
