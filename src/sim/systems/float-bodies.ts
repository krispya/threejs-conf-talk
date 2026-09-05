import { Not, type World } from 'koota';
import { Anchor, Float, Hidden, Position, Rotation, Time } from '../traits/index.js';

/** Drifts each body around its anchor on a slow, slightly lopsided orbit with a gentle tilt. */
export function floatBodies(world: World) {
  const { elapsed } = world.get(Time)!;

  world
    .query(Position, Rotation, Anchor, Float, Not(Hidden))
    .updateEach(([position, rotation, anchor, float]) => {
      const t = elapsed * float.speed + float.phase;

      position.x = anchor.x + Math.sin(t * 0.7) * float.amplitude;
      position.y = anchor.y + Math.sin(t) * float.amplitude;
      position.z = anchor.z + Math.cos(t * 0.5) * float.amplitude * 0.5;

      rotation.x = Math.sin(t * 0.6) * float.tilt;
      rotation.y = Math.cos(t * 0.4) * float.tilt;
      rotation.z = Math.sin(t * 0.8) * float.tilt;
    });
}
