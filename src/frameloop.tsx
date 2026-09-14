import { createProfileLayout } from './profile/utils/layout.js';
import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { useMemo } from 'react';
import { profiles } from './profile/data.js';
import { advanceTimeline } from './timeline/systems.js';
import { placeProfiles, focusProfiles, wanderProfiles } from './profile/systems.js';
import { updateTime } from './time/systems.js';
import { moveCamera, updateBounds } from './camera/systems.js';
import { resizePackages, placePackages } from './package/systems.js';
import { updateAnchors } from './letter/systems.js';
import { floatBodies } from './floating/systems.js';
import { syncTransforms } from './view/systems.js';

// The application owns the order in which domain systems run.
export function FrameLoop() {
  const world = useWorld();
  const profileLayout = useMemo(() => createProfileLayout(profiles.length), []);

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
