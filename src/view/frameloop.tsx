import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { useState } from 'react';
import { profiles } from '../data/profiles.js';
import { advanceTimeline, systems } from '../sim/index.js';

const {
  updateTime,
  moveCamera,
  resizePackages,
  updateAnchors,
  placePackages,
  placeProfiles,
  floatBodies,
  focusProfiles,
  wanderProfiles,
  syncTransforms,
  updateBounds,
} = systems;

export function FrameLoop() {
  const world = useWorld();
  const [profileLayout] = useState(() => systems.createProfileLayout(profiles.length));

  useFrame((state, delta) => {
    updateTime(world, delta, state.elapsed);
    advanceTimeline(world);
    moveCamera(world);
    resizePackages(world);
    updateAnchors(world);
    placePackages(world);
    placeProfiles(world, profileLayout);
    floatBodies(world);
    focusProfiles(world);
    wanderProfiles(world);
    syncTransforms(world);

    updateBounds(world, state.viewport.getCurrentViewport(state.camera));
  });

  return null;
}
