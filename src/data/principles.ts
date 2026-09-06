export const principles = [
  {
    id: 'simple',
    title: 'Simple',
    description:
      'Software should be simple to understand and use with clear models and elegant interfaces. The API and philosophy should fit in a single readme and explained in three steps or less.',
    position: { x: -6, y: 3, z: 5 },
    mapPosition: { x: -10, y: 12, z: 5 },
    color: '#ff514f',
    brightness: 1,
    connections: ['stable', 'open'],
  },
  {
    id: 'pragmatic',
    title: 'Pragmatic',
    description:
      'Projects should solve demonstrated problems for a meaningful community of developers, avoiding speculative projects.',
    position: { x: 6, y: 5, z: -6 },
    mapPosition: { x: 17, y: 17, z: -6 },
    color: '#62c9ff',
    brightness: 0.65,
    connections: ['stable', 'open'],
  },
  {
    id: 'stable',
    title: 'Stable',
    description:
      'Software should earn long term trust. Libraries refine over time, but aim to be stable, achieved primarily through being both simple and practical.',
    position: { x: -1, y: -2, z: 2 },
    mapPosition: { x: 2, y: -7, z: 2 },
    color: '#35b6ff',
    brightness: 1.15,
    connections: [],
  },
  {
    id: 'open',
    title: 'Open',
    description:
      'Software should be free to use, understand, and improve. Projects are built in public with paths for anyone to contribute.',
    position: { x: 8, y: -4, z: -2 },
    mapPosition: { x: 22, y: -17, z: -2 },
    color: '#75d8ff',
    brightness: 0.8,
    connections: ['stable'],
  },
] as const;
