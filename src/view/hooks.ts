import { IsHidden, IsPresent } from '../traits.js';
import type { FrameTimingState, RootState } from '@react-three/fiber/webgpu';
import type { Entity, ExtractSchema, Trait, TraitValue } from 'koota';
import { useHas, useActions, useWorld } from 'koota/react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Object3D } from 'three/webgpu';
import { viewActions } from './actions.js';

/** One unit of per-frame view work, in the shape of a `useFrame` callback. */
export type FrameStep = (state: RootState & FrameTimingState, delta: number) => void;

/** Read visibility immediately while subscribing to later trait changes. */
export function useEntityVisible(entity: Entity) {
  // useHas starts false until its effect runs, so it cannot initialize visibility.
  useHas(entity, IsHidden);
  return entity.isAlive() && !entity.has(IsHidden);
}

/** Whether the entity's view should stay mounted, from its entrance until its exit finishes. */
export function useEntityPresent(entity: Entity) {
  useHas(entity, IsPresent);
  return entity.isAlive() && entity.has(IsPresent);
}

type Part<V, K extends keyof V> = V[K] extends readonly (infer E)[] ? E : V[K];

/** `bind(key)` or `bind(key, index)` is a ref callback that fills a part in as its object mounts. */
function usePartsBinder<V extends object>(value: V) {
  return useCallback(
    <K extends keyof V>(key: K, index?: number) =>
      (object: Part<V, K> | null) => {
        const slot = value[key];
        if (index !== undefined && Array.isArray(slot)) slot[index] = object;
        else value[key] = object as V[K];
      },
    [value]
  );
}

/**
 * Register mounted parts with the entity for the lifetime of the view, so systems can animate
 * them. Returns the parts binder.
 */
export function useTraitBinding<T extends Trait, V extends TraitValue<ExtractSchema<T>>>(
  entity: Entity,
  trait: T,
  value: V
) {
  useLayoutEffect(() => {
    if (!entity.isAlive()) return;
    if (entity.has(trait)) entity.set(trait, value);
    else entity.add(trait(value));
    return () => {
      if (entity.isAlive() && entity.get(trait) === value) entity.remove(trait);
    };
  }, [entity, trait, value]);
  return usePartsBinder(value);
}

/**
 * Spawn an entity that carries a view's parts for the lifetime of the view, for views and
 * providers that have no entity of their own. Returns the parts binder.
 */
export function useSpawnedParts<T extends Trait, V extends TraitValue<ExtractSchema<T>>>(
  trait: T,
  value: V
) {
  const world = useWorld();
  useLayoutEffect(() => {
    const entity = world.spawn(trait(value));
    return () => {
      entity.destroy();
    };
  }, [world, trait, value]);
  return usePartsBinder(value);
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

/**
 * Register a child's per-frame step with the parent that owns the frame callback.
 * The parent runs its own update first and then each registered step in registration order,
 * so views that must follow their parent within a frame need no scheduler priority.
 */
export function useFrameStep(steps: Set<FrameStep>, step: FrameStep) {
  const latest = useRef(step);
  useLayoutEffect(() => {
    latest.current = step;
  });
  useLayoutEffect(() => {
    const run: FrameStep = (state, delta) => latest.current(state, delta);
    steps.add(run);
    return () => {
      steps.delete(run);
    };
  }, [steps]);
}
