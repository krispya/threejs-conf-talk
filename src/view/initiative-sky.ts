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
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { Node, Texture } from 'three/webgpu';

/** A fixed celestial sphere behind slowly folding curtains of auroral light. */
export function initiativeSky(stars: Texture, phase: Node<'float'>) {
  return Fn(() => {
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
    const starlight = texture(stars, skyUV)
      .r.mul(0.42)
      .mul(smoothstep(-0.65, 0.05, p.y))
      .mul(curtains.length().mul(1.5).clamp().oneMinus());
    base.addAssign(curtains);
    base.addAssign(color('#d7e3f2').mul(starlight));
    return vec4(base, 1);
  })();
}
