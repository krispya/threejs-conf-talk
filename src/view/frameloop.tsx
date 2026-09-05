import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { systems, traits } from '../sim/index.js';

const { Bounds } = traits;
const { updateTime, moveCamera, updateAnchors, placePackages, floatBodies, syncTransforms } = systems;

export function FrameLoop() {
  const world = useWorld();

  useFrame((state, delta) => {
    updateTime(world, delta, state.elapsed);
    moveCamera(world);
    updateAnchors(world);
    placePackages(world);
    floatBodies(world);
    syncTransforms(world);

    const viewport = state.viewport.getCurrentViewport(state.camera);
    world.set(Bounds, { width: viewport.width, height: viewport.height });
  });

  return null;
}
