import { relation, trait } from 'koota';
import type { Object3D } from 'three/webgpu';

// World-level traits
export const Time = trait({ delta: 0, elapsed: 0 });
export const Bounds = trait({ width: 0, height: 0 });

// Screen graph
export const Screen = trait({
  id: '',
  titleVisible: false,
  lettersVisible: true,
  packagesVisible: true,
  packageNames: () => [] as readonly string[],
  packageLayout: 'spread' as 'spread' | 'pair',
  packageStagger: 0,
  packageDelay: 0,
  packageDuration: 0,
  packageEntry: 'scale' as 'scale' | 'rise',
  packageDownloadsVisible: false,
  packageFeaturesVisible: false,
  codeComparisonVisible: false,
  robotVisible: false,
  warpVisible: false,
  autoAdvance: false,
  packageSizing: 'compressed' as 'compressed' | 'proportional',
  profilesVisible: false,
  backgroundVisible: true,
  background: 'pastel' as 'solid' | 'pastel' | 'stars',
  constellation: '',
  constellationMap: false,
  charterVisible: false,
  charterHighlight: '' as '' | 'initiatives',
  initiativesVisible: false,
  initiativePortalVisible: false,
});
export const ScreenTransition = trait({
  duration: 0,
  cameraDelay: 0,
  cameraEase: 'auto' as 'auto' | 'cubicIn' | 'portalFall',
  revealDelay: 0,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
});
export const Timeline = trait({ startedAt: 0, duration: 0 });
export const ScreenOf = relation({ exclusive: true, autoDestroy: 'orphan' });
export const FirstScreen = relation({ exclusive: true });
export const ActiveScreen = relation({ exclusive: true });
export const NextScreen = relation({ exclusive: true });
export const PreviousScreen = relation({ exclusive: true });

// Entity traits
export const Camera = trait({ fov: 45, near: 0.1, far: 5000 });
export const Hidden = trait();
export const Letter = trait({ char: '', index: 0 });
export const Package = trait({ name: '', label: '', downloads: 0, index: 0 });
export const PackageSizing = trait({ compressed: 1, proportional: 1 });
export const Profile = trait({ login: '', avatar: '', index: 0 });
export const Charter = trait();
export const Title = trait({ text: '' });
export const Initiative = trait({
  id: '',
  title: '',
  color: '#ffffff',
  video: '',
  source: '',
  secret: false,
});
export const Discovered = trait();
export const Constellation = trait({ id: '', title: '' });
export const ConstellationExpansion = trait({ value: 0, from: 0, to: 0 });
export const ConstellationLayout = trait({
  compactX: 0,
  compactY: 0,
  compactZ: 0,
  mapX: 0,
  mapY: 0,
  mapZ: 0,
});
export const ConstellationMember = relation({ exclusive: true, autoDestroy: 'orphan' });
export const ConnectedTo = relation();
export const Principle = trait({ id: '', title: '', description: '' });
export const Star = trait({
  color: '#ffffff',
  brightness: 1,
  twinklePhase: 0,
  twinkleSpeed: 0.18,
  streakAngle: 0,
  streakLength: 1,
});
export const Size = trait({ radius: 1 });
export const SizeTransition = trait({ from: 1, to: 1 });
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
