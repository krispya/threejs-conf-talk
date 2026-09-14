import { IsHidden, Position, Rotation } from '../traits.js';
import { Anchor, Float } from '../floating/traits.js';
import { createActions } from 'koota';
import { initiatives } from './data.js';
import { Initiative } from './traits.js';

export const initiativeActions = createActions((world) => ({
  setInitiativesVisible: (visible: boolean) => {
    for (const entity of world.query(Initiative)) {
      if (visible) entity.remove(IsHidden);
      else entity.add(IsHidden);
    }
  },
  createInitiatives: () =>
    initiatives.map(({ position, ...data }, index) =>
      world.spawn(
        Initiative(data),
        IsHidden,
        Position(position),
        Anchor(position),
        Rotation,
        Float({ amplitude: 0.8, speed: 0.14, phase: index * 2.4, tilt: 0 })
      )
    ),
}));
