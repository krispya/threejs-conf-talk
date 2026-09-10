import type { Entity } from 'koota';
import { useHas } from 'koota/react';
import { Hidden } from '../sim/traits/index.js';

/** Read visibility immediately while subscribing to later trait changes. */
export function useEntityVisible(entity: Entity) {
  // useHas starts false until its effect runs, so it cannot initialize visibility.
  useHas(entity, Hidden);
  return entity.isAlive() && !entity.has(Hidden);
}
