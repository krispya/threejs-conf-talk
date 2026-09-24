import { createProfileLayout } from './profile/utils/layout.js';
import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { profiles } from './profile/data.js';
import { advanceTimeline } from './timeline/systems.js';
import {
  animateProfiles,
  layoutTeamConnections,
  placeProfiles,
  focusProfiles,
  wanderProfiles,
} from './profile/systems.js';
import { updateTime } from './time/systems.js';
import { moveCamera, updateBounds } from './camera/systems.js';
import {
  animateDownloadCounters,
  animateFeatureChips,
  animatePackages,
  placeMaintainerPortraits,
  placePackages,
  resizePackages,
} from './package/systems.js';
import { updateAnchors } from './letter/systems.js';
import { floatBodies } from './floating/systems.js';
import { syncTransforms } from './view/systems.js';
import { captureBackdrop } from './glass/systems.js';
import { composeShowreel } from './background/systems.js';
import { advanceTransitions, syncTransitionUniforms } from './transition/systems.js';
import { listenForSounds, playSounds } from './sound/systems.js';

// The application owns the order in which domain systems run. Systems run ahead of every view
// callback, which keeps the default priority, and captures that read the finished frame run last.
export function FrameLoop() {
  const world = useWorld();
  const profileLayout = createProfileLayout(profiles.length);

  useFrame(
    (state, delta) => {
      updateTime(world, delta, state.elapsed);
      advanceTimeline(world);
      advanceTransitions(world);
      syncTransitionUniforms(world);
      moveCamera(world);
      resizePackages(world);
      updateAnchors(world);
      placePackages(world);
      placeProfiles(world, profileLayout);
      floatBodies(world);
      focusProfiles(world);
      wanderProfiles(world);
      syncTransforms(world);
      animateProfiles(world);
      // Package attachments follow the sphere placed by syncTransforms and animatePackages
      animatePackages(world);
      animateDownloadCounters(world);
      animateFeatureChips(world);
      placeMaintainerPortraits(world);
      // The listener runs last so it hears everything the frame changed
      listenForSounds(world);
      playSounds(world);

      updateBounds(world, state.viewport.getCurrentViewport(state.camera));
    },
    { priority: 1 }
  );

  // Captures read the finished frame, so they run after every view callback in this order
  useFrame(
    (state) => {
      layoutTeamConnections(world, state.camera, state.scene, (target) =>
        state.viewport.getCurrentViewport(state.camera, target)
      );
      composeShowreel(world, state.renderer);
      captureBackdrop(world, state.renderer, state.scene, state.camera, state.frame);
    },
    { priority: -1 }
  );

  return null;
}
