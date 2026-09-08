import type { World } from 'koota';
import { mulberry32 } from 'math/random';
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

export function createProfileLayout(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('Invalid profile capacity');
  return {
    capacity,
    count: -1,
    aspect: NaN,
    inputs: new Float64Array(capacity * 3),
    points: new Float64Array(capacity * 2),
    seed: mulberry32.create(0),
  };
}

export type ProfileLayout = ReturnType<typeof createProfileLayout>;

/**
 * Cache the seeded packing in caller-owned storage, then project it into the framing.
 * Unchanged frames take O(n), repacking takes O(32 n²), and storage takes O(capacity).
 * Invalid framing or exhausted capacity returns false without moving any portraits.
 */
export function placeProfiles(world: World, layout: ProfileLayout): boolean {
  const bounds = world.get(Bounds);
  const camera = world.queryFirst(Camera)?.get(Camera);
  const destination = world
    .query(Screen, ScreenTransition)
    .find((entity) => entity.get(Screen)!.profilesVisible)
    ?.get(ScreenTransition);
  if (!bounds || !camera || !destination) return false;

  const profiles = world.query(Profile, Anchor, Size, Float);
  const aspect = bounds.width / bounds.height;
  const vertical = Math.tan((camera.fov * Math.PI) / 360);
  if (
    profiles.length > layout.capacity ||
    !(bounds.width > 0 && bounds.height > 0 && aspect > 0) ||
    !Number.isFinite(aspect) ||
    !(camera.fov > 0 && camera.fov < 180) ||
    !Number.isFinite(destination.cameraX) ||
    !Number.isFinite(destination.cameraY)
  ) {
    layout.count = -1;
    return false;
  }

  let valid = true;
  profiles.useStores(([profile, anchor, size, motion], entities) => {
    // Ignore aspect roundoff from a moving viewport, far below one pixel at 8K.
    let changed =
      layout.count !== entities.length ||
      !Number.isFinite(layout.aspect) ||
      Math.abs(aspect - layout.aspect) > 1e-12;
    const { inputs, points, seed } = layout;
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i].id();
      const halfHeight = (destination.cameraZ - anchor.z[id]) * vertical;
      const radius = (size.radius[id] + motion.amplitude[id] + 0.05) / halfHeight;
      if (
        !(halfHeight > 0) ||
        !Number.isFinite(halfHeight) ||
        !Number.isFinite(radius) ||
        radius < 0 ||
        !Number.isFinite(profile.index[id])
      ) {
        layout.count = -1;
        valid = false;
        return;
      }
      const offset = i * 3;
      if (
        inputs[offset] !== profile.index[id] ||
        inputs[offset + 1] !== halfHeight ||
        inputs[offset + 2] !== radius
      )
        changed = true;
      inputs[offset] = profile.index[id];
      inputs[offset + 1] = halfHeight;
      inputs[offset + 2] = radius;
    }

    if (changed) {
      for (let i = 0; i < entities.length; i++) {
        seed.a = (inputs[i * 3] + 1) | 0;
        const radius = inputs[i * 3 + 2];
        const width = Math.max(0, aspect - radius - 0.05);
        const height = Math.max(0, 1 - radius - 0.05);
        let clearance = -Infinity;

        // Pick the roomiest seeded candidate, allowing space for the float orbit.
        for (let candidate = 0; candidate < 32; candidate++) {
          const angle = mulberry32.sample(seed) * (Math.PI * 2);
          const spread = Math.sqrt(mulberry32.sample(seed));
          const x = Math.cos(angle) * spread * width;
          const y = Math.sin(angle) * spread * height;
          let nearest = Infinity;
          for (let j = 0; j < i; j++) {
            nearest = Math.min(
              nearest,
              Math.hypot(x - points[j * 2], y - points[j * 2 + 1]) - radius - inputs[j * 3 + 2]
            );
          }
          if (nearest > clearance) {
            points[i * 2] = x;
            points[i * 2 + 1] = y;
            clearance = nearest;
          }
        }
      }
      layout.count = entities.length;
      layout.aspect = aspect;
    }

    for (let i = 0; i < entities.length; i++) {
      const id = entities[i].id();
      anchor.x[id] = destination.cameraX + points[i * 2] * inputs[i * 3 + 1];
      anchor.y[id] = destination.cameraY + points[i * 2 + 1] * inputs[i * 3 + 1];
    }
  });
  return valid;
}
