import { trait } from 'koota';
import type { Group, Mesh, MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';

/** A retained glyph label whose text and style the package systems update in place. */
export interface GlyphLabel {
  style: object;
  set(update: { text?: string; style?: object }): void;
}

export const Package = trait({ name: '', label: '', downloads: 0, index: 0 });
export const PackageSizing = trait({ compressed: 1, proportional: 1 });

export const SizeTransition = trait({ from: 1, to: 1 });

/** Entrance and exit of the sphere. The presentation action captures it, a system advances it. */
export const PackagePresence = trait({
  value: 0,
  from: 0,
  target: 0,
  startedAt: 0,
  delay: 0,
  duration: 0,
  spring: false,
  community: false,
  // Seconds the whole group takes to leave downward, or -1 when spheres settle in place
  exit: -1,
});

/** Weekly download ticker beneath the sphere. */
export const DownloadCounter = trait({
  visible: false,
  // A first showing resets the retained glyphs before the ticker rises
  fresh: false,
  startedAt: 0,
  countStartedAt: 0,
  countDuration: 0,
  counting: false,
  stagger: 0,
  fromOpacity: 0,
  opacity: 0,
  fromY: -0.42,
  y: -0.42,
  fromScale: 0.92,
  scale: 0.92,
  anchorX: 0,
  anchorY: 0,
  anchorZ: 0,
  fromAnchorX: 0,
  fromAnchorY: 0,
  fromAnchorZ: 0,
  rejoining: false,
  countFrom: 0,
  tick: -1,
  value: -1,
});

/** Feature chips that follow the three sphere and arrive after the packages settle. */
export const FeatureChips = trait(() => ({
  visible: false,
  items: Array.from({ length: 2 }, () => ({ value: 0, from: 0, target: 0, delay: 0 })),
}));

// Mounted objects the package systems animate. Views register them while mounted.

export const PackageParts = trait(() => ({
  body: null as Mesh | null,
  label: null as GlyphLabel | null,
  labelGroup: null as Group | null,
  chip: null as MeshBasicNodeMaterial | null,
}));

export const DownloadParts = trait(() => ({
  group: null as Group | null,
  number: null as GlyphLabel | null,
  backdrop: null as MeshBasicNodeMaterial | null,
}));

export const FeatureParts = trait(() => ({
  root: null as Group | null,
  chips: [] as (Group | null)[],
  labels: [] as (GlyphLabel | null)[],
  materials: [] as (MeshBasicNodeMaterial | null)[],
}));

export const MaintainerParts = trait(() => ({
  opacity: null! as UniformNode<'float', number>,
  groups: [] as (Group | null)[],
}));
