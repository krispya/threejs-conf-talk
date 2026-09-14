import { trait } from 'koota';
import type {
  Group,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  Object3D,
  UniformNode,
} from 'three/webgpu';

export const Profile = trait({ login: '', avatar: '', index: 0 });

/** Entrance and exit of the portrait. The presentation action captures it, a system advances it. */
export const ProfilePresence = trait({
  value: 0,
  from: 0,
  target: 0,
  // Ring screens share the ring's staggered spring for their fades
  focusing: false,
});

// Mounted objects the profile system animates. Views register them while mounted.
export const ProfileParts = trait(() => ({
  portrait: null as MeshBasicNodeMaterial | null,
  border: null as MeshBasicMaterial | null,
  dim: null! as UniformNode<'float', number>,
  aura: null as Group | null,
  auraReveal: null! as UniformNode<'float', number>,
}));
/** A soft network of links between the settled team, registered by its view. */
export const TeamNetwork = trait(() => ({
  group: null as Group | null,
  opacity: null! as UniformNode<'float', number>,
  story: false,
  connections: [] as readonly (readonly [number, number])[],
  // Projected portrait centers and radii with the robot last, kept while the network exits
  nodes: [] as { x: number; y: number; radius: number }[],
  robot: undefined as Object3D | undefined,
}));

export const ProfileFocus = trait({
  value: 0,
  from: 0,
  to: 0,
  slot: -1,
  count: 0,
  scale: 1,
  scaleFrom: 1,
  fromTeam: false,
  // How far a portrait has dropped behind the newcomers, from 0 in front to 1 receded
  recede: 0,
  recedeFrom: 0,
  recedeTo: 0,
  wanderX: 0,
  wanderY: 0,
  wanderFromX: 0,
  wanderFromY: 0,
  wanderOpacity: 1,
  wanderFromOpacity: 1,
});
