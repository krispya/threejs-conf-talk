import { createActions } from 'koota';
import { clamp } from 'math';
import { principles } from '../data/principles.js';
import { initiatives } from '../data/initiatives.js';
import {
  Anchor,
  Camera,
  Charter,
  ConnectedTo,
  Constellation,
  ConstellationExpansion,
  ConstellationLayout,
  ConstellationMember,
  Float,
  Hidden,
  Initiative,
  Letter,
  Package,
  PackageSizing,
  Position,
  Principle,
  Profile,
  Rotation,
  Size,
  SizeTransition,
  Star,
  TargetPosition,
  Title,
  TransitionOrigin,
} from './traits/index.js';

/** Compress the download range logarithmically for the opening screen. */
export function compressedRadiusForDownloads(downloads: number, min: number, max: number) {
  if (max <= min) return 1.4;
  const share = Math.log10(downloads / min) / Math.log10(max / min);
  return 0.32 + clamp(share, 0, 1) * (1.4 - 0.32);
}

/** Scale bubble area with downloads while keeping the smallest packages visible. */
export function radiusForDownloads(downloads: number, max: number) {
  return Math.max(0.32, 2.8 * Math.sqrt(clamp(downloads / Math.max(1, max), 0, 1)));
}

export const actions = createActions((world) => ({
  createTitle: () => world.spawn(Title({ text: 'Beyond\nReact Three\nFiber' }), Hidden, Position),

  createInitiatives: () =>
    initiatives.map(({ position, ...data }, index) =>
      world.spawn(
        Initiative(data),
        Hidden,
        Position(position),
        Anchor(position),
        Rotation,
        Float({ amplitude: 0.8, speed: 0.14, phase: index * 2.4, tilt: 0 })
      )
    ),

  createCharter: () => world.spawn(Charter, Hidden, Position({ x: 106, y: 8, z: -66 })),

  createPrinciplesConstellation: () => {
    const constellation = world.spawn(
      Constellation({ id: 'principles', title: 'Principles' }),
      ConstellationExpansion,
      Hidden,
      Position({ x: 100, y: 10, z: -120 }),
      Anchor({ x: 100, y: 10, z: -120 }),
      Rotation,
      Float({ amplitude: 0.55, speed: 0.15, phase: 0.8, tilt: 0 })
    );
    const stars = principles.map(
      ({ id, title, description, color, brightness, position, mapPosition }, index) =>
        world.spawn(
          Principle({ id, title, description }),
          Star({
            color,
            brightness,
            twinklePhase: index * 23.47,
            twinkleSpeed: (0.75 + (index % 3) * 0.19) / 5,
            streakLength: 0.8 + (index % 3) * 0.2,
          }),
          ConstellationMember(constellation),
          ConstellationLayout({
            compactX: position.x,
            compactY: position.y,
            compactZ: position.z,
            mapX: mapPosition.x,
            mapY: mapPosition.y,
            mapZ: mapPosition.z,
          }),
          Hidden,
          Position(position),
          Anchor(position),
          Rotation,
          Float({ amplitude: 0.35, speed: 0.18, phase: index * 2.4, tilt: 0 })
        )
    );
    for (const [index, principle] of principles.entries()) {
      for (const target of principle.connections) {
        stars[index].add(ConnectedTo(stars.find((star) => star.get(Principle)!.id === target)!));
      }
    }
    return constellation;
  },

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
        speed: 0.4 + Math.random() * 0.3,
        amplitude: 0.08 + Math.random() * 0.04,
        tilt: 0.025 + Math.random() * 0.02,
      })
    );
  },

  createProfile: (login: string, avatar: string, index: number, depthIndex = index) =>
    world.spawn(
      Profile({ login, avatar, index }),
      Hidden,
      Size({ radius: 0.55 + (index % 4) * 0.07 }),
      Position,
      Rotation,
      // Separate depth layers leave room for the float orbit and tilted portrait edges
      Anchor({ z: -13 - depthIndex * 0.45 }),
      Float({
        phase: index * 2.4,
        speed: 0.3 + (index % 3) * 0.08,
        amplitude: 0.16,
        tilt: 0.06,
      })
    ),

  // Packages get no Anchor here: placePackages assigns one once the bounds are known.
  createPackage: (
    name: string,
    downloads: number,
    index: number,
    radius: number,
    proportionalRadius = radius,
    label = name
  ) => {
    return world.spawn(
      Package({ name, label, downloads, index }),
      PackageSizing({ compressed: radius, proportional: proportionalRadius }),
      Size({ radius }),
      SizeTransition({ from: radius, to: radius }),
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
