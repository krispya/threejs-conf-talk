import { createActions, type Entity } from 'koota';
import type { Object3D } from 'three/webgpu';
import { Ref } from './traits.js';

export const viewActions = createActions(() => ({
  attachView: (entity: Entity, object: Object3D) => {
    if (entity.has(Ref)) entity.set(Ref, object);
    else entity.add(Ref(object));
  },
  detachView: (entity: Entity, object: Object3D) => {
    if (entity.isAlive() && entity.get(Ref) === object) entity.remove(Ref);
  },
}));
