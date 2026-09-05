import { createActions } from 'koota';
import { Camera, Hidden, Package, TargetPosition } from '../traits/index.js';

export const intro = {
  id: 'intro',
  actions: createActions((world) => ({
    enter: () => {
      for (const entity of world.query(Package)) entity.remove(Hidden);
      for (const entity of world.query(Camera, TargetPosition)) {
        entity.set(TargetPosition, { x: 0, y: 0, z: 12 });
      }
    },
  })),
} as const;
