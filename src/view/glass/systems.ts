import type { World } from 'koota';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import { Time } from '../../time/traits.js';
import { Backdrop } from '../traits.js';
import { captureTransmissionBackdrop } from './transmission-backdrop.js';

/** Capture the finished frame behind every active glass material, once per frame. */
export function captureBackdrop(
  world: World,
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  frame: number
) {
  const backdrop = world.queryFirst(Backdrop)?.get(Backdrop);
  if (!backdrop) return;
  const elapsed = world.get(Time)!.elapsed;
  for (const material of backdrop.materials.keys())
    material.transmissionUniforms.time.value = elapsed;
  captureTransmissionBackdrop(backdrop, renderer, scene, camera, frame);
}
