import { useFrame, useThree } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { useEffect } from 'react';
import { systems, traits } from '../sim/index.js';

const { Bounds } = traits;
const { updateTime, updateAnchors, placePackages, floatBodies, syncTransforms } = systems;

export function FrameLoop() {
  const world = useWorld();
  const viewport = useThree((state) => state.viewport);

  useFrame((state, delta) => {
    updateTime(world, delta, state.elapsed);
    updateAnchors(world);
    placePackages(world);
    floatBodies(world);
    syncTransforms(world);
  });

  // Sync bounds to the visible viewport
  useEffect(() => {
    world.set(Bounds, { width: viewport.width, height: viewport.height });
  }, [world, viewport.width, viewport.height]);

  return null;
}
