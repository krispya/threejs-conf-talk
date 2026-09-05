import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { systems } from '../sim/index.js';

const {
  updateTime,
  moveCamera,
  updateAnchors,
  placePackages,
  placeProfiles,
  floatBodies,
  syncTransforms,
  updateBounds,
} = systems;

export function FrameLoop() {
  const world = useWorld();

  useFrame((state, delta) => {
    updateTime(world, delta, state.elapsed);
    moveCamera(world);
    updateAnchors(world);
    placePackages(world);
    placeProfiles(world);
    floatBodies(world);
    syncTransforms(world);

    updateBounds(world, state.viewport.getCurrentViewport(state.camera));
  });

  return null;
}
