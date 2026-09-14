import { Position, Rotation } from '../traits.js';
import { TargetPosition, Camera } from './traits.js';
import { TransitionOrigin } from '../timeline/traits.js';
import { createActions } from 'koota';

export const cameraActions = createActions((world) => ({
  setCameraTarget: (target: { x: number; y: number; z: number }) => {
    for (const camera of world.query(Camera, TargetPosition)) camera.set(TargetPosition, target);
  },
  finishCameraTransition: () => {
    world.query(Camera, Position, TargetPosition).updateEach(([, position, target]) => {
      position.x = target.x;
      position.y = target.y;
      position.z = target.z;
    });
  },
  createCamera: () =>
    world.spawn(
      Camera,
      Position({ z: 12 }),
      TargetPosition({ z: 12 }),
      TransitionOrigin({ z: 12 }),
      Rotation
    ),
}));
