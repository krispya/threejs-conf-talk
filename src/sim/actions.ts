import { createActions } from 'koota';
import {
  Anchor,
  Camera,
  Float,
  Letter,
  Package,
  Position,
  Rotation,
  Size,
  TargetPosition,
  TransitionOrigin,
} from './traits/index.js';

const MIN_RADIUS = 0.32;
const MAX_RADIUS = 1.4;

/** Maps downloads onto a blob radius on a log scale so small packages stay legible. */
export function radiusForDownloads(downloads: number, min: number, max: number) {
  const t = (Math.log10(downloads) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return MIN_RADIUS + Math.max(0, Math.min(1, t)) * (MAX_RADIUS - MIN_RADIUS);
}

export const actions = createActions((world) => ({
  createCamera: () =>
    world.spawn(
      Camera,
      Position({ z: 12 }),
      TargetPosition({ z: 12 }),
      TransitionOrigin({ z: 12 }),
      Rotation
    ),

  createLetter: (char: string, index: number) => {
    return world.spawn(
      Letter({ char, index }),
      Position,
      Rotation,
      Anchor,
      Float({
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.5,
        amplitude: 0.2 + Math.random() * 0.15,
        tilt: 0.08 + Math.random() * 0.08,
      })
    );
  },

  // Packages get no Anchor here: placePackages assigns one once the bounds are known.
  createPackage: (name: string, downloads: number, index: number, radius: number) => {
    return world.spawn(
      Package({ name, downloads, index }),
      Size({ radius }),
      Position,
      Rotation,
      Float({
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.25,
        amplitude: 0.15 + Math.random() * 0.15,
        tilt: 0,
      })
    );
  },
}));
