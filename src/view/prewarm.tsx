import { useFrame } from '@react-three/fiber/webgpu';
import { useRef } from 'react';
import { useTransmissionBackdrop } from './glass/transmission-backdrop-provider.js';
import { warmUp } from './warm-up.js';

/**
 * Compile every pipeline the talk can reach before its screen arrives. Renderers mount as their
 * assets resolve, so the scene is warmed again whenever its object count settles. Each warm-up
 * covers the canvas and the glass capture target, which use different pipelines.
 */
export function Prewarm() {
  const backdrop = useTransmissionBackdrop();
  const state = useRef({ count: -1, stable: 0, warmed: -1 });
  useFrame(({ renderer, scene, camera }) => {
    if (!renderer.hasInitialized()) return;
    let count = 0;
    scene.traverse(() => count++);
    const pending = state.current;
    if (count !== pending.count) {
      pending.count = count;
      pending.stable = 0;
      return;
    }
    if (pending.warmed === count || ++pending.stable < 30) return;
    pending.warmed = count;
    void warmUp(renderer, scene, camera, scene);
    void warmUp(renderer, scene, camera, scene, backdrop.cleanTarget);
  });
  return null;
}
