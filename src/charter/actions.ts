import { IsHidden, Position } from '../traits.js';
import { createActions } from 'koota';
import { Charter } from './traits.js';

export const charterActions = createActions((world) => ({
  setCharterVisible: (visible: boolean) => {
    for (const entity of world.query(Charter)) {
      if (visible) entity.remove(IsHidden);
      else entity.add(IsHidden);
    }
  },
  createCharter: () => world.spawn(Charter, IsHidden, Position({ z: -11 })),
}));
