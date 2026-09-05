// Screens are visited in list order, with transition durations in seconds
export const screens = [
  {
    id: 'intro',
    packagesVisible: true,
    profilesVisible: false,
    transition: { duration: 0.5, cameraX: 0, cameraY: 0, cameraZ: 12 },
  },
  {
    id: 'letters',
    packagesVisible: false,
    profilesVisible: false,
    transition: { duration: 0.9, cameraX: 0, cameraY: 0, cameraZ: 10 },
  },
  {
    id: 'profiles',
    packagesVisible: false,
    profilesVisible: true,
    transition: { duration: 1.8, cameraX: 0, cameraY: 0, cameraZ: -5 },
  },
] as const;

export type ScreenId = (typeof screens)[number]['id'];
