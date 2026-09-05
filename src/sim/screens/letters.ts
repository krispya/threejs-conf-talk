import { createActions } from 'koota';
import { Camera, Hidden, Package, TargetPosition } from '../traits/index.js';

export const letters = {
  id: 'letters',
  actions: createActions((world) => ({
    enter: () => {
      const packages = world.query(Package);
      for (const entity of packages) entity.add(Hidden);
      for (const entity of world.query(Camera, TargetPosition)) {
        entity.set(TargetPosition, { x: 0, y: 0, z: 10 });
      }

      return () => {
        for (const entity of packages) {
          if (entity.isAlive()) entity.remove(Hidden);
        }
      };
    },
  })),
} as const;
