import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { ActiveScreen, Screen, Timeline } from './traits.js';

/** Subscribe to the active screen without subscribing to the per-frame clock. */
export function useActiveScreen() {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  return { timeline, screen, data };
}
