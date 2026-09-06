import type { World } from 'koota';
import { mulberry32, random } from 'math/random';
import {
  Anchor,
  Bounds,
  Camera,
  Float,
  Profile,
  Screen,
  ScreenTransition,
  Size,
} from '../traits/index.js';

/** Scatter portraits across the destination framing with staggered depth for parallax. */
export function placeProfiles(world: World) {
  const bounds = world.get(Bounds);
  const camera = world.queryFirst(Camera)?.get(Camera);
  const destination = world
    .query(Screen, ScreenTransition)
    .find((entity) => entity.get(Screen)!.profilesVisible)
    ?.get(ScreenTransition);
  if (!bounds?.height || !camera || !destination) return;

  const profiles = world.query(Profile, Anchor, Size, Float);
  const aspect = bounds.width / bounds.height;
  const placed: { x: number; y: number; radius: number }[] = [];

  profiles.updateEach(([profile, anchor, size, motion]) => {
    const seed = mulberry32.create(profile.index + 1);
    const sample = () => mulberry32.sample(seed);
    const halfHeight = (destination.cameraZ - anchor.z) * Math.tan((camera.fov * Math.PI) / 360);
    const radius = (size.radius + motion.amplitude + 0.05) / halfHeight;
    const point = { x: 0, y: 0, radius };
    let clearance = -Infinity;

    // Pick the roomiest of a few seeded candidates, allowing space for the float orbit
    for (let candidate = 0; candidate < 32; candidate++) {
      const angle = random.float(sample, 0, Math.PI * 2);
      const spread = Math.sqrt(random.float(sample, 0, 1));
      const x = Math.cos(angle) * spread * Math.max(0, aspect - radius - 0.05);
      const y = Math.sin(angle) * spread * Math.max(0, 1 - radius - 0.05);
      let nearest = Infinity;
      for (const other of placed) {
        nearest = Math.min(nearest, Math.hypot(x - other.x, y - other.y) - radius - other.radius);
      }
      if (nearest > clearance) {
        point.x = x;
        point.y = y;
        clearance = nearest;
      }
    }

    placed.push(point);
    anchor.x = destination.cameraX + point.x * halfHeight;
    anchor.y = destination.cameraY + point.y * halfHeight;
  });
}
