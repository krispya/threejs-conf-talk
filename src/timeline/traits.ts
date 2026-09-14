import { relation, trait } from 'koota';

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
  benchmarkVariant: 'spider' as 'spider' | 'three',
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
export const OwnedByTimeline = relation({ exclusive: true, autoDestroy: 'orphan' });
export const ScreenOf = relation({ exclusive: true, autoDestroy: 'orphan' });
export const FirstScreen = relation({ exclusive: true });
export const ActiveScreen = relation({ exclusive: true });
export const NextScreen = relation({ exclusive: true });
export const PreviousScreen = relation({ exclusive: true });

export const TransitionOrigin = trait({ x: 0, y: 0, z: 0 });
