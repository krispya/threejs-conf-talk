import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Fn, Loop, float, mix, normalize, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl';
import {
  HalfFloatType,
  PMREMGenerator,
  LinearFilter,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type WebGPURenderer,
} from 'three/webgpu';
import { hash21, spectrum } from '../src/background/utils/starfield.js';

// Match the runtime shader's loosely typed TSL helpers.
/* oxlint-disable typescript/no-explicit-any */
type N = any;
const fn: N = Fn;

const noise = fn(([point]: N[]) => {
  const cell = point.floor();
  const f = point.fract();
  const blend = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(
    mix(hash21(cell), hash21(cell.add(vec2(1, 0))), blend.x),
    mix(hash21(cell.add(vec2(0, 1))), hash21(cell.add(1)), blend.x),
    blend.y
  );
}).setLayout({ name: 'starNoise', type: 'float', inputs: [{ name: 'point', type: 'vec2' }] });

/** Layered value noise. Broad fields get by with few octaves, which keeps the nebula cheap. */
const layeredNoise = (octaves: number) =>
  fn(([point]: N[]) => {
    const p = point.toVar();
    const result = float(0).toVar();
    const amplitude = float(0.5).toVar();
    Loop(octaves, () => {
      result.addAssign(noise(p).mul(amplitude));
      p.mulAssign(2.03);
      amplitude.mulAssign(0.5);
    });
    return result;
  }).setLayout({
    name: `starNoise${octaves}`,
    type: 'float',
    inputs: [{ name: 'point', type: 'vec2' }],
  });
const fbm = layeredNoise(3);
const detail = layeredNoise(4);

/**
 * Cloud density over plane coordinates in [-2, 2] x [-1, 1]. A broad body mask keeps most of the
 * sky clear, and inside it one noise field displaces another so the gas flows in filaments.
 */
const cloud = fn(([q]: N[]) => {
  const warp = vec2(fbm(q.mul(1.25)), fbm(q.mul(1.25).add(vec2(5.2, 0))))
    .sub(0.5)
    .toVar();
  // Three octaves of noise sit between 0 and 0.875, so the mask thresholds around its middle.
  // The offset keeps the view off the lattice origin, where value noise is pinned to zero.
  const body = smoothstep(
    0.4,
    0.62,
    fbm(q.mul(1.1).add(warp.mul(0.9)).add(vec2(37.7, 91.3))).sub(q.x.mul(0.05))
  );
  const gas = detail(q.mul(2.3).add(warp.mul(3.2)).add(vec2(11.3, 7.9)));
  const wisp = detail(q.mul(5.5).add(warp.mul(4.5)).add(vec2(3.7, 19.1)));
  return body.mul(gas.mul(1.1).add(0.1)).mul(wisp.pow(1.5).mul(0.8).add(0.2)).clamp();
}).setLayout({ name: 'starCloud', type: 'float', inputs: [{ name: 'q', type: 'vec2' }] });

/**
 * Nebula bake. rgb is the gas emission and a is dust transmission. An unseen star off the cloud's
 * edge lights it, so rims that face it glow while the body behind them goes dark and blocks the starfield.
 */
const nebulaNode = Fn(() => {
  const p = uv().sub(0.5).mul(vec2(4, 2));
  const star = vec2(0.12, 0.06);
  const density = cloud(p).toVar();
  const gradient = vec2(
    cloud(p.add(vec2(0.012, 0))).sub(cloud(p.sub(vec2(0.012, 0)))),
    cloud(p.add(vec2(0, 0.012))).sub(cloud(p.sub(vec2(0, 0.012))))
  );
  const toStar = star.sub(p);
  const reach = float(1).div(toStar.dot(toStar).mul(3).add(1));
  // Density rising away from the star means this edge faces it
  const rim = gradient.dot(normalize(toStar)).negate().mul(10).clamp().mul(reach);
  // Purple through magenta for the body, cooling toward the star's blue white where it is lit
  const phase = density.mul(1.2).add(p.x.mul(0.3)).fract().mul(2).sub(1).abs();
  const tint = mix(spectrum(float(0.94).add(phase.mul(0.2))), vec3(0.72, 0.8, 1), rim.mul(0.7));
  // Thin gas glows while dense cores absorb their own light and read as dark lanes
  const emission = tint.mul(
    density
      .mul(float(1).sub(density.mul(0.75)))
      .mul(1.1)
      .add(rim.mul(1.2))
  );
  return vec4(emission, density.mul(-3.5).exp());
});

/** Render the nebula once so the sky pays for a texture sample instead of layered noise per pixel. */
export function bakeNebula(renderer: WebGPURenderer) {
  const target = new RenderTarget(2048, 1024, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  target.texture.name = 'Nebula';
  const material = new NodeMaterial();
  material.fragmentNode = nebulaNode();
  const quad = new QuadMesh(material);
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    quad.render(renderer);
    return target;
  } catch (error) {
    target.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previous);
    material.dispose();
  }
}

/* oxlint-enable typescript/no-explicit-any */

/** Store the filtered cube-UV atlas so material roughness needs no runtime convolution. */
export function bakeEnvironment(renderer: WebGPURenderer) {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try {
    return generator.fromScene(room, 0.04);
  } finally {
    generator.dispose();
    room.dispose();
  }
}

/** Rasterize the authored emoji once instead of depending on the viewer's system font. */
export function bakeEmoji(emoji: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.font = '180px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(emoji, 128, 138);
  return canvas;
}

/** Convert Three's inverted-Y render-target PMREM into an externally authored cube-UV atlas. */
export function orientEnvironment(data: Uint16Array, width: number, height: number) {
  const output = data.slice();
  const cubeSize = height / 4;
  for (let mip = Math.log2(cubeSize); mip >= -2; mip--) {
    const size = 2 ** Math.max(4, mip);
    const x = Math.max(4 - mip, 0) * 3 * 16;
    const y = 4 * (cubeSize - size);
    for (let face = 0; face < 6; face++) {
      const sourceFace = face === 1 ? 4 : face === 4 ? 1 : face;
      for (let row = 0; row < size; row++) {
        const destination =
          ((y + Math.floor(face / 3) * size + row) * width + x + (face % 3) * size) * 4;
        const source =
          ((y + Math.floor(sourceFace / 3) * size + size - 1 - row) * width +
            x +
            (sourceFace % 3) * size) *
          4;
        output.set(data.subarray(source, source + size * 4), destination);
      }
    }
  }
  return output;
}
