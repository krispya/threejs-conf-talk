import type { World } from 'koota';
import { lerp } from 'math';
import { Camera, Position, TargetPosition, Time } from '../traits/index.js';

export function moveCamera(world: World) {
  const { delta } = world.get(Time)!;
  const alpha = 1 - Math.exp(-4 * delta);

  world.query(Camera, Position, TargetPosition).updateEach(([, position, target]) => {
    position.x = lerp(position.x, target.x, alpha);
    position.y = lerp(position.y, target.y, alpha);
    position.z = lerp(position.z, target.z, alpha);

    if (Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z) < 0.001) {
      position.x = target.x;
      position.y = target.y;
      position.z = target.z;
    }
  });
}
