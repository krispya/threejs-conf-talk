import type { Camera, Object3D, RenderTarget, Scene, WebGPURenderer } from 'three/webgpu';

/**
 * Compile the pipelines for a hidden subtree ahead of its first visible frame. Projection runs
 * synchronously inside compileAsync, so visibility, culling, and the render target are restored
 * before returning while the pipelines finish building in the background.
 */
export function warmUp(
  renderer: WebGPURenderer,
  object: Object3D,
  camera: Camera,
  scene?: Scene,
  target: RenderTarget | null = null
) {
  if (!renderer.hasInitialized()) return;
  const restore: (() => void)[] = [];
  object.traverse((child) => {
    const { visible, frustumCulled } = child;
    child.visible = true;
    child.frustumCulled = false;
    restore.push(() => {
      child.visible = visible;
      child.frustumCulled = frustumCulled;
    });
  });
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  void renderer.compileAsync(object, camera, scene);
  renderer.setRenderTarget(previous);
  for (const undo of restore) undo();
}
