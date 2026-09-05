import type { World } from 'koota';
import { Anchor, Bounds, Camera, Profile, Screen, ScreenTransition } from '../traits/index.js';

/** Spread portraits across the destination framing with staggered depth for parallax. */
export function placeProfiles(world: World) {
  const bounds = world.get(Bounds);
  const camera = world.queryFirst(Camera)?.get(Camera);
  const destination = world
    .query(Screen, ScreenTransition)
    .find((entity) => entity.get(Screen)!.profilesVisible)
    ?.get(ScreenTransition);
  if (!bounds?.height || !camera || !destination) return;

  const profiles = world.query(Profile, Anchor);
  const aspect = bounds.width / bounds.height;
  const rows = Math.max(1, Math.round(Math.sqrt(profiles.length / aspect)));
  const columns = Math.ceil(profiles.length / rows);

  profiles.updateEach(([profile, anchor]) => {
    const row = Math.floor(profile.index / columns);
    const count = Math.min(columns, profiles.length - row * columns);
    const halfHeight = (destination.cameraZ - anchor.z) * Math.tan((camera.fov * Math.PI) / 360);
    anchor.x =
      destination.cameraX +
      ((((profile.index % columns) + 0.5) / count) * 2 - 1) * halfHeight * aspect * 0.86 +
      Math.sin(profile.index * 2.4) * 0.12;
    anchor.y =
      destination.cameraY +
      (1 - ((row + 0.5) / rows) * 2) * halfHeight * 0.85 +
      Math.cos(profile.index * 1.7) * 0.16;
  });
}
