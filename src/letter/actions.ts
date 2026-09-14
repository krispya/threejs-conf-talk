import { IsHidden } from '../traits.js';
import { Position, Rotation } from '../traits.js';
import { Anchor, Float } from '../floating/traits.js';
import { createActions } from 'koota';
import { Letter } from './traits.js';

export const letterActions = createActions((world) => {
  const createLetter = (char: string, index: number) => {
    return world.spawn(
      Letter({ char, index }),
      Position,
      Rotation,
      Anchor,
      Float({
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.3,
        amplitude: 0.08 + Math.random() * 0.04,
        tilt: 0.025 + Math.random() * 0.02,
      })
    );
  };
  return {
    setLettersVisible: (visible: boolean) => {
      for (const entity of world.query(Letter)) {
        if (visible) entity.remove(IsHidden);
        else entity.add(IsHidden);
      }
    },
    createLetter,
    createLetters: () => {
      return Array.from('PMNDRS', (char, index) => createLetter(char, index));
    },
  };
});
