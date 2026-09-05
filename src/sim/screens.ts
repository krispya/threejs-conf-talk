// Screens are visited in list order, with transition durations in seconds
export const screens = [
  {
    id: 'intro',
    packagesVisible: true,
    transition: { duration: 0.5, cameraX: 0, cameraY: 0, cameraZ: 12 },
  },
  {
    id: 'letters',
    packagesVisible: false,
    transition: { duration: 0.9, cameraX: 0, cameraY: 0, cameraZ: 10 },
  },
] as const;

export type ScreenId = (typeof screens)[number]['id'];
