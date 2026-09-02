import type { World } from 'koota';
import { Position, Ref, Rotation } from '../traits/index.js';

/** Projects the data model onto the Three objects owned by the view. */
export function syncTransforms(world: World) {
  world.query(Position, Rotation, Ref).updateEach(([position, rotation, object]) => {
    object.position.set(position.x, position.y, position.z);
    object.rotation.set(rotation.x, rotation.y, rotation.z);
  });
}
