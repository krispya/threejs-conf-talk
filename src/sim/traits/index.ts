import { relation, trait } from 'koota';
import type { Object3D } from 'three/webgpu';

// World-level traits
export const Time = trait({ delta: 0, elapsed: 0 });
export const Bounds = trait({ width: 0, height: 0 });

// Screen graph
export const Screen = trait({ id: '', packagesVisible: true, profilesVisible: false });
export const ScreenTransition = trait({ duration: 0, cameraX: 0, cameraY: 0, cameraZ: 0 });
export const Timeline = trait({ startedAt: 0, duration: 0 });
export const ScreenOf = relation({ exclusive: true, autoDestroy: 'orphan' });
export const FirstScreen = relation({ exclusive: true });
export const ActiveScreen = relation({ exclusive: true });
export const NextScreen = relation({ exclusive: true });
export const PreviousScreen = relation({ exclusive: true });

// Entity traits
export const Camera = trait({ fov: 45, near: 0.1, far: 100 });
export const Hidden = trait();
export const Letter = trait({ char: '', index: 0 });
export const Package = trait({ name: '', downloads: 0, index: 0 });
export const Profile = trait({ login: '', avatar: '', index: 0 });
export const Size = trait({ radius: 1 });
export const Position = trait({ x: 0, y: 0, z: 0 });
export const TargetPosition = trait({ x: 0, y: 0, z: 0 });
export const TransitionOrigin = trait({ x: 0, y: 0, z: 0 });
export const Rotation = trait({ x: 0, y: 0, z: 0 });

// The slot a body floats around. Letter slots are laid out in Letter.index order.
export const Anchor = trait({ x: 0, y: 0, z: 0 });

// Per-body float motion: a slow orbit around the anchor with a gentle tilt.
export const Float = trait({ phase: 0, speed: 1, amplitude: 0.25, tilt: 0.12 });

// Three object that renders the entity. Assigned by the view.
export const Ref = trait(() => null! as Object3D);
