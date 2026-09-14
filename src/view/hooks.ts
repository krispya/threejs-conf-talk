import { IsHidden } from '../traits.js';
import type { Entity } from 'koota';
import { useHas, useActions } from 'koota/react';
import { useCallback } from 'react';
import type { Object3D } from 'three/webgpu';
import { viewActions } from './actions.js';

/** Read visibility immediately while subscribing to later trait changes. */
export function useEntityVisible(entity: Entity) {
  // useHas starts false until its effect runs, so it cannot initialize visibility.
  useHas(entity, IsHidden);
  return entity.isAlive() && !entity.has(IsHidden);
}

/** Bind a mounted object and release only that object's registration on cleanup. */
export function useViewBinding(entity: Entity) {
  const { attachView, detachView } = useActions(viewActions);
  return useCallback(
    (object: Object3D | null) => {
      if (!object) return;
      attachView(entity, object);
      return () => detachView(entity, object);
    },
    [entity, attachView, detachView]
  );
}
