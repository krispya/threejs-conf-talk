import { Not, type World } from 'koota';
import {
  Anchor,
  ActiveScreen,
  Camera,
  Float,
  Hidden,
  Letter,
  Package,
  Position,
  Profile,
  Rotation,
  Screen,
  ScreenTransition,
  Time,
  Timeline,
} from '../traits/index.js';

/** Drifts each body around its anchor on a slow, slightly lopsided orbit with a gentle tilt. */
export function floatBodies(world: World) {
  const { elapsed } = world.get(Time)!;
  const camera = world.queryFirst(Camera, Position)?.get(Position);
  const screens = world.query(Screen, ScreenTransition);
  const pinPackage =
    world.queryFirst(Timeline)?.targetFor(ActiveScreen)?.get(Screen)?.packageLayout === 'community';
  const letterCameraZ = screens
    .find((entity) => entity.get(Screen)!.lettersVisible)
    ?.get(ScreenTransition)?.cameraZ;
  const profileCameraZ = screens
    .find((entity) => entity.get(Screen)!.profilesVisible)
    ?.get(ScreenTransition)?.cameraZ;

  world
    .query(Position, Rotation, Anchor, Float, Not(Hidden))
    .updateEach(([position, rotation, anchor, float], entity) => {
      if (pinPackage && entity.has(Package)) {
        position.x = anchor.x;
        position.y = anchor.y;
        position.z = anchor.z;
        rotation.x = rotation.y = rotation.z = 0;
        return;
      }
      const t = elapsed * float.speed + float.phase;
      const referenceZ = entity.has(Letter)
        ? letterCameraZ
        : entity.has(Profile)
          ? profileCameraZ
          : undefined;
      // Preserve visible drift as the camera recedes from each body's original framing
      const distanceScale =
        camera && referenceZ !== undefined && referenceZ > anchor.z
          ? Math.max(1, (camera.z - anchor.z) / (referenceZ - anchor.z))
          : 1;
      // Keep the word near its baseline while portraits can drift farther in space
      const amplitude =
        float.amplitude * (entity.has(Letter) ? Math.min(distanceScale, 2) : distanceScale);

      position.x = anchor.x + Math.sin(t * 0.7) * amplitude;
      position.y = anchor.y + Math.sin(t) * amplitude;
      // Keep depth excursions small so portraits stay in their separate layers
      position.z = anchor.z + Math.cos(t * 0.5) * float.amplitude * 0.5;

      rotation.x = Math.sin(t * 0.6) * float.tilt;
      rotation.y = Math.cos(t * 0.4) * float.tilt;
      rotation.z = Math.sin(t * 0.8) * float.tilt;
    });
}
