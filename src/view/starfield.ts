import {
  Fn,
  Loop,
  cameraPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  dot,
  float,
  getViewPosition,
  mix,
  normalize,
  sRGBTransferEOTF,
  screenUV,
  smoothstep,
  texture,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  HalfFloatType,
  LinearFilter,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';

// TSL nodes are loosely typed to keep the reference shader's math readable
/* oxlint-disable typescript/no-explicit-any */
type N = any;
const fn: N = Fn;

const hash21 = fn(([point]: N[]) => {
  const p = point.mul(vec2(123.34, 456.21)).fract().toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return p.x.mul(p.y).fract();
}).setLayout({ name: 'starHash21', type: 'float', inputs: [{ name: 'point', type: 'vec2' }] });

const hash22 = fn(([point]: N[]) => {
  const a = hash21(point).toVar();
  return vec2(a, hash21(point.add(a).add(7.13)));
}).setLayout({ name: 'starHash22', type: 'vec2', inputs: [{ name: 'point', type: 'vec2' }] });

const hash33 = fn(([point]: N[]) => {
  const a = hash21(point).toVar();
  const b = hash21(point.add(a).add(3.71)).toVar();
  return vec3(a, b, hash21(point.add(b).add(9.13)));
}).setLayout({ name: 'starHash33', type: 'vec3', inputs: [{ name: 'point', type: 'vec2' }] });

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

/** The reference's cyclic brand palette, authored in display color space. */
const spectrum = fn(([phase]: N[]) => {
  const hue = phase.fract().mul(7);
  const value = vec3(0.847, 0.333, 0.976).toVar();
  value.assign(mix(value, vec3(1, 0.286, 0.502), hue.clamp()));
  value.assign(mix(value, vec3(1, 0.753, 0.263), hue.sub(1).clamp()));
  value.assign(mix(value, vec3(0.922, 1, 0.059), hue.sub(2).clamp()));
  value.assign(mix(value, vec3(0.792, 0.961, 0.263), hue.sub(3).clamp()));
  value.assign(mix(value, vec3(0, 0.969, 0.639), hue.sub(4).clamp()));
  value.assign(mix(value, vec3(0.169, 0.863, 0.965), hue.sub(5).clamp()));
  value.assign(mix(value, vec3(0.847, 0.333, 0.976), hue.sub(6).clamp()));
  return value;
}).setLayout({ name: 'starSpectrum', type: 'vec3', inputs: [{ name: 'phase', type: 'float' }] });

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
  const material = new NodeMaterial();
  material.fragmentNode = nebulaNode();
  const quad = new QuadMesh(material);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  quad.render(renderer);
  renderer.setRenderTarget(previous);
  material.dispose();
  return target;
}

/** Dark mineral mode from reference/glitter-pearl/glitter-pearl-shadertoy.glsl. */
export const starfieldNode = (nebula: Texture) =>
  Fn(() => {
    const t: N = time;
    // A distant plane gives the sky gentle parallax during the camera pullback
    const view = getViewPosition(screenUV, float(0.5), cameraProjectionMatrixInverse);
    const direction = cameraWorldMatrix.mul(vec4(view, 0)).xyz.toVar();
    const distance = float(-400).sub(cameraPosition.z).div(direction.z);
    const point = cameraPosition.add(direction.mul(distance));
    const p = point.xy.div(520 * 2 * Math.tan((45 * Math.PI) / 360)).toVar();
    const light = vec2(t.mul(0.32).sin().mul(0.55), t.mul(0.23).cos().mul(0.3));
    const delta = p.sub(light);
    const radius = delta.length();
    const radial = delta.div(radius.max(0.0001));
    const cycle = radius.mul(1.55);
    const band = smoothstep(0.78, 1.12, cycle).mul(float(1).sub(smoothstep(1.88, 2.22, cycle)));
    const visibility = mix(float(1), band, 0.82);
    const lightDirection = normalize(vec3(light.sub(p), 0.62));
    const halfway = normalize(lightDirection.add(vec3(0, 0, 1)));

    const grid = p.mul(191);
    const cell = grid.floor();
    const local = grid.fract().sub(0.5);
    const sparkles = vec3(0).toVar();

    // Neighboring cells keep glints continuous as the background moves
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        const offset = vec2(x, y);
        const random = hash33(cell.add(offset)).toVar();
        const center = offset.add(random.yz.sub(0.5).mul(0.82));
        const d = local.sub(center).length().div(2.5);
        const core = float(1).sub(smoothstep(0, 0.13, d));
        const tilt = hash22(cell.add(offset).add(11.71)).sub(0.5).mul(1.5).toVar();
        tilt.addAssign(
          vec2(
            t.mul(random.y.mul(1.3).add(0.5)).add(random.z.mul(21)).sin(),
            t.mul(random.z.mul(1.1).add(0.4)).add(random.y.mul(17)).cos()
          ).mul(0.05)
        );
        const normal = normalize(vec3(tilt, 0.72));
        const specular = dot(normal, halfway).max(0).pow(80).mul(random.z.mul(0.9).add(0.6));
        const hue = cycle
          .sub(1)
          .add(dot(tilt, radial).mul(0.14))
          .add(random.y.mul(0.1))
          .sub(t.mul(0.02));
        const bloom = d.mul(d).mul(-90).exp().mul(0.22);
        const weight = specular.mul(core.add(bloom)).mul(visibility);
        sparkles.addAssign(mix(vec3(1), spectrum(hue).mul(1.25), band).mul(weight));
      }
    }

    // The reference's stone body, relief lighting, clouding, and cursor halo are all left out.
    // Flow map: two samples drift along a gentle vector field on staggered cycles, and the
    // crossfade gives zero weight to whichever sample is about to reset so the jump never shows
    const flow = vec2(
      p.y.mul(4.1).sin().mul(0.6).add(p.x.mul(2.3).add(1.7).sin().mul(0.4)),
      p.x.mul(3.7).cos().mul(0.6).add(p.y.mul(2.9).add(0.8).cos().mul(0.4))
    ).mul(0.035);
    const phase = t.mul(0.06).fract();
    const sample = (offset: number) =>
      texture(
        nebula,
        p
          .add(flow.mul(phase.add(offset).fract()))
          .mul(vec2(0.25, 0.5))
          .add(0.5)
      );
    const cloud = mix(sample(0), sample(0.5), phase.mul(2).sub(1).abs());
    const transmission = cloud.a;
    const result = vec3(0.047, 0.039, 0.024)
      .mul(transmission.mul(0.4).add(0.6))
      .add(sparkles.mul(3.2).mul(transmission))
      .add(cloud.rgb.mul(0.55))
      .toVar();
    result.assign(result.div(result.mul(0.85).add(1)).pow(0.82));

    // Three applies the output transfer, so decode the reference's display-ready color first
    return vec4(sRGBTransferEOTF(result.clamp().mul(0.8)) as N, 1);
  });
/* oxlint-enable typescript/no-explicit-any */
