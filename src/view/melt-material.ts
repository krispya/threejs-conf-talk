import { atan, color, Fn, mix, positionLocal, smoothstep, time } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { spectrum } from '../theme.js';

export class MeltMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({ roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.4 });
    this.name = 'MeltMaterial';
    const surface = Fn(() => {
      const cycle = time.div(12).fract();
      const phase = cycle.mul(Math.PI * 2);
      const longitude = atan(positionLocal.x, positionLocal.z);
      const gravity = smoothstep(-0.9, 0.75, positionLocal.y).oneMinus().pow(1.2);
      const drips = longitude
        .mul(5)
        .add(phase)
        .add(positionLocal.y.mul(0.65))
        .sin()
        .mul(0.5)
        .add(0.5)
        .pow(4)
        .mul(0.85)
        .add(longitude.mul(9).sub(phase.mul(2)).add(0.8).sin().mul(0.5).add(0.5).pow(6).mul(0.3));
      const ripple = longitude.mul(3).add(phase).add(positionLocal.y.mul(2.5)).sin().mul(0.035);

      // Increasing the band coordinate carries each color downward through the drips.
      const flow = positionLocal.y.add(drips.mul(gravity)).add(ripple).mul(0.5).add(cycle);
      const band = flow.fract();
      const edge = flow.fwidth().mul(0.65).max(0.0001);
      const paint = color(spectrum[0]).toVar();
      for (let index = 1; index < spectrum.length; index++) {
        paint.assign(
          mix(
            paint,
            color(spectrum[index]),
            smoothstep(
              edge.negate().add(index / spectrum.length),
              edge.add(index / spectrum.length),
              band
            )
          )
        );
      }
      return paint;
    })();
    this.colorNode = surface;
    this.emissiveNode = surface.mul(0.12);
  }
}
