import { IsHidden, IsPresent } from '../traits.js';
import { useMutableCallback, type FrameTimingState, type RootState } from '@react-three/fiber/webgpu';
import { Not, type Entity, type ExtractSchema, type Trait, type TraitValue } from 'koota';
import { useQuery, useActions, useWorld } from 'koota/react';
import { useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react';
import type { Object3D } from 'three/webgpu';
import { viewActions } from './actions.js';

/** One unit of per-frame view work, in the shape of a `useFrame` callback. */
export type FrameStep = (state: RootState & FrameTimingState, delta: number) => void;

/** Subscribe to visible membership, including the initial render. */
export function useEntityVisible(entity: Entity) {
  return useQuery(Not(IsHidden)).includes(entity);
}

/** Whether the entity's view should stay mounted, from its entrance until its exit finishes. */
export function useEntityPresent(entity: Entity) {
  return useQuery(IsPresent).includes(entity);
}

type Part<V, K extends keyof V> = V[K] extends readonly (infer E)[] ? E : V[K];

/** `bind(key)` or `bind(key, index)` is a ref callback that fills a part in as its object mounts. */
function createPartsBinder<V extends object>(value: V | null) {
  return <K extends keyof V>(key: K, index?: number) =>
    (object: Part<V, K> | null) => {
      if (!value) return;
      const slot = value[key];
      if (index !== undefined && Array.isArray(slot)) slot[index] = object;
      else value[key] = object as V[K];
    };
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
  return createPartsBinder(value);
}

/**
 * Spawn an entity that carries a view's parts for the lifetime of the view, for views and
 * providers that have no entity of their own. Returns the parts binder.
 */
export function useSpawnedParts<T extends Trait, V extends TraitValue<ExtractSchema<T>>>(
  trait: T,
  value: V | null
) {
  const world = useWorld();
  useLayoutEffect(() => {
    if (!value) return;
    const entity = world.spawn(trait(value));
    return () => {
      entity.destroy();
    };
  }, [world, trait, value]);
  return createPartsBinder(value);
}

/** Bind a mounted object and release only that object's registration on cleanup. */
export function useViewBinding(entity: Entity) {
  const { attachView, detachView } = useActions(viewActions);
  return (object: Object3D | null) => {
    if (!object) return;
    attachView(entity, object);
    return () => detachView(entity, object);
  };
}

/**
 * Register a child's per-frame step with the parent that owns the frame callback.
 * The parent runs its own update first and then each registered step in registration order,
 * so views that must follow their parent within a frame need no scheduler priority.
 */
export function useFrameStep(steps: Set<FrameStep>, step: FrameStep) {
  const latestRef = useMutableCallback(step);
  useLayoutEffect(() => {
    const run: FrameStep = (state, delta) => latestRef.current(state, delta);
    steps.add(run);
    return () => {
      steps.delete(run);
    };
  }, [steps, latestRef]);
}

/**
 * Create after commit and dispose each setup's resource. Dependencies control recreation.
 * Return the render value and a ref for imperative access, cleared before disposal.
 */
export function useResource<T>(
  create: () => T,
  dispose: (resource: T) => void,
  dependencies: DependencyList
): [resource: T | null, resourceRef: RefObject<T | null>] {
  const [resource, setResource] = useState<T | null>(null);
  const resourceRef = useRef<T | null>(null);
  // The caller supplies the resource dependencies
  /* oxlint-disable react/exhaustive-deps */
  useLayoutEffect(() => {
    const resource = create();
    resourceRef.current = resource;
    // oxlint-disable-next-line react/set-state-in-effect -- Expose committed resources to the view
    setResource(() => resource);
    return () => {
      if (resourceRef.current === resource) resourceRef.current = null;
      dispose(resource);
    };
  }, dependencies);
  /* oxlint-enable react/exhaustive-deps */
  return [resource, resourceRef];
}
