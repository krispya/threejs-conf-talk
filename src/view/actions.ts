import { createActions, type Entity } from 'koota';
import type { Object3D, UniformNode } from 'three/webgpu';
import { Ref, TransitionUniform } from './traits.js';

export const viewActions = createActions(() => ({
  attachView: (entity: Entity, object: Object3D) => {
    if (entity.has(Ref)) entity.set(Ref, object);
    else entity.add(Ref(object));
  },
  detachView: (entity: Entity, object: Object3D) => {
    if (entity.isAlive() && entity.get(Ref) === object) entity.remove(Ref);
  },
  attachUniform: (entity: Entity, node: UniformNode<'float', number>) => {
    if (entity.has(TransitionUniform)) entity.set(TransitionUniform, node);
    else entity.add(TransitionUniform(node));
  },
}));
