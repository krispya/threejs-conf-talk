import {
  Fn,
  asin,
  atan,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  color,
  float,
  getViewPosition,
  mix,
  mx_noise_float,
  screenUV,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  HalfFloatType,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type Node,
  type PerspectiveCamera,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';

/**
 * A fixed celestial sphere behind slowly folding curtains of auroral light. The curtains are
 * six noise fields per pixel, so they render into a half resolution target that the sky samples.
 * The preview camera only dollies, so the curtains depend on screen position and time alone.
 */
export function createInitiativeSky(stars: Texture, phase: Node<'float'>) {
  const aspect = uniform(1);
  const tanHalfFov = uniform(Math.tan(Math.PI / 8));
  const target = new RenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  target.texture.name = 'InitiativeAurora';
  const material = new NodeMaterial();
  material.fragmentNode = Fn(() => {
    // The same field the full sky derives from its view ray, written in screen terms. The
    // target's rows come back flipped when the sky samples them, so y is written inverted.
    const p = screenUV.mul(2).sub(1).mul(vec2(aspect, -1)).mul(tanHalfFov).mul(2);
    const curtains = vec3(0).toVar();
    const drift = phase.mul(0.065);
    for (let layer = 0; layer < 3; layer++) {
      const x = p.x.add(p.y.mul(0.16)).add(layer * 1.7);
      const folds = mx_noise_float(vec3(x.mul(1.3), drift, layer + 3));
      const edge = x
        .mul(1.7)
        .add(drift)
        .sin()
        .mul(0.16)
        .add(folds.mul(0.15))
        .add(layer * 0.18 - 0.18);
      const height = p.y.sub(edge);
      const curtain = smoothstep(-0.035, 0.035, height)
        .mul(height.max(0).mul(-3.4).exp())
        .mul(smoothstep(0.9, 0.2, height));
      const threads = mx_noise_float(vec3(x.mul(32).add(folds.mul(6)), height.mul(1.2), drift))
        .mul(0.5)
        .add(0.5);
      const foldsLight = x.mul(18).add(folds.mul(9)).sub(drift).sin().mul(0.2).add(0.8);
      const hue = mix(color('#38bfa0'), color('#9964bc'), smoothstep(0.03, 0.45, height));
      curtains.addAssign(hue.mul(curtain).mul(threads.mul(0.65).add(0.35)).mul(foldsLight).mul(0.32));
    }
    return vec4(curtains, 1);
  })();
  const quad = new QuadMesh(material);

  const node = Fn(() => {
    const view = getViewPosition(screenUV, float(0.5), cameraProjectionMatrixInverse);
    const ray = cameraWorldMatrix.mul(vec4(view, 0)).xyz.normalize();
    // Face the northern sky around RA 18h and declination +49 degrees
    const north = vec3(
      ray.x,
      ray.y.mul(Math.cos(0.85)).sub(ray.z.mul(Math.sin(0.85))),
      ray.y.mul(Math.sin(0.85)).add(ray.z.mul(Math.cos(0.85)))
    );
    const skyUV = vec2(
      atan(north.z, north.x)
        .div(Math.PI * 2)
        .add(1)
        .fract(),
      asin(north.y.clamp(-1, 1)).div(Math.PI).add(0.5)
    );
    const p = ray.xy.div(ray.z.abs().max(0.1)).mul(2);
    const base = mix(color('#14151f'), color('#060e1c'), smoothstep(-0.6, 0.8, p.y)).rgb.toVar();
    const curtains = texture(target.texture, screenUV).rgb;
    const starlight = texture(stars, skyUV)
      .r.mul(0.42)
      .mul(smoothstep(-0.65, 0.05, p.y))
      .mul(curtains.length().mul(1.5).clamp().oneMinus());
    base.addAssign(curtains);
    base.addAssign(color('#d7e3f2').mul(starlight));
    return vec4(base, 1);
  })();

  return {
    node,
    /** Refresh the curtains for the preview camera at half the given drawing buffer size. */
    render(renderer: WebGPURenderer, camera: PerspectiveCamera, width: number, height: number) {
      target.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
      aspect.value = camera.aspect;
      tanHalfFov.value = Math.tan((camera.fov * Math.PI) / 360);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      quad.render(renderer);
      renderer.setRenderTarget(previous);
    },
    dispose() {
      target.dispose();
      material.dispose();
    },
  };
}
