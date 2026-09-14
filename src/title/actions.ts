import { IsHidden, Position } from '../traits.js';
import { createActions } from 'koota';
import { Title } from './traits.js';

export const titleActions = createActions((world) => ({
  setTitleVisible: (visible: boolean) => {
    for (const entity of world.query(Title)) {
      if (visible) entity.remove(IsHidden);
      else entity.add(IsHidden);
    }
  },
  createTitle: () => world.spawn(Title({ text: 'Beyond\nReact Three\nFiber' }), IsHidden, Position),
}));
