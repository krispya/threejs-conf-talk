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
  packageLayout: 'spread' as 'spread' | 'pair' | 'community',
  packageStagger: 0,
  packageDelay: 0,
  packageDuration: 0,
  packageEntry: 'scale' as 'scale' | 'rise',
  packageDownloadsVisible: false,
  packageFeaturesVisible: false,
  packageMaintainersVisible: false,
  codeComparisonVisible: false,
  robotVisible: false,
  communityRobotVisible: false,
  communityDeparture: false,
  teamVisible: false,
  robotFriendly: false,
  robotJoinDelay: 0,
  warpVisible: false,
  autoAdvance: false,
  packageSizing: 'compressed' as 'compressed' | 'proportional',
  profilesVisible: false,
  focusedProfile: '',
  surroundingProfiles: () => [] as readonly string[],
  recedingProfiles: () => [] as readonly string[],
  greetingVisible: false,
  historyPages: 0,
  showreelVisible: false,
  /** Tile the wall closes in on before cutting to the next clip, or -1 to hold the wall. */
  showreelFocus: -1,
  backgroundVisible: true,
  background: 'pastel' as 'solid' | 'pastel' | 'stars' | 'blue',
  principlesVisible: false,
  principlesLogo: false,
  charterVisible: false,
  charterHighlight: '' as '' | 'initiatives',
  charterFocus: false,
  storyProfile: '',
  storyConnectionsVisible: false,
  announcementVisible: false,
  initiativesVisible: false,
  initiativeChips: () => [] as readonly string[],
  initiativePortalVisible: false,
  /** Initiative previewed inside the stone portal, by id */
  initiative: '',
  benchmarkVisible: false,
  closingVisible: false,
});
export const ScreenTransition = trait({
  duration: 0,
  cameraDelay: 0,
  cameraDuration: 0,
  cameraEase: 'auto' as 'auto' | 'cubicIn' | 'cubicInOut' | 'portalFall',
  revealDelay: 0,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
});
export const Timeline = trait({ startedAt: 0, duration: 0, departureStartedAt: -1 });
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
