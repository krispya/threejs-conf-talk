import type { ProfileLogin } from './profiles.js';

/**
 * Libraries by weekly npm downloads, one entry per library (largest package counted).
 * Lead maintainer handles reference allProfiles. Null means the current lead is unconfirmed.
 * Sources and the review date are recorded in maintainers.md.
 */
export const packages = [
  { name: 'zustand', downloads: 54_493_939, leadMaintainers: ['dai-shi'] },
  { name: '@use-gesture/react', downloads: 6_814_965, leadMaintainers: ['dbismut'] },
  { name: 'jotai', downloads: 6_105_244, leadMaintainers: ['dai-shi'] },
  { name: 'react-spring', downloads: 5_512_280, leadMaintainers: ['joshuaellis'] },
  {
    name: '@react-three/fiber',
    downloads: 5_129_998,
    leadMaintainers: ['DennisSmolek', 'krispya'],
  },
  { name: '@react-three/drei', downloads: 3_902_005, leadMaintainers: ['DennisSmolek'] },
  { name: 'detect-gpu', downloads: 3_807_044, leadMaintainers: ['DennisSmolek'] },
  { name: 'valtio', downloads: 1_970_285, leadMaintainers: ['dai-shi'] },
  // Lead inferred from the latest maintenance and release activity
  { name: 'leva', downloads: 983_605, leadMaintainers: ['gsimone'] },
  { name: 'postprocessing', downloads: 839_165, leadMaintainers: ['vanruesc'] },
  { name: '@react-three/postprocessing', downloads: 713_956, leadMaintainers: ['kvvasuu'] },
  { name: '@react-three/rapier', downloads: 117_814, leadMaintainers: ['wiledal'] },
  { name: 'cannon-es', downloads: 109_385, leadMaintainers: ['isaac-mason'] },
  { name: '@react-three/xr', downloads: 48_758, leadMaintainers: ['bbohlender'] },
  { name: '@react-three/uikit', downloads: 17_019, leadMaintainers: ['bbohlender'] },
  { name: 'koota', downloads: 13_025, leadMaintainers: ['krispya'] },
  // npm downloads for 2026-08-23 through 2026-08-29, matching the R3F snapshot
  { name: 'three', downloads: 15_193_062, leadMaintainers: ['mrdoob'] },
] as const satisfies readonly {
  name: string;
  downloads: number;
  leadMaintainers: readonly ProfileLogin[] | null;
}[];
