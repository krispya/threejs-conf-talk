import {
  uniform,
  atan,
  attribute,
  color,
  float,
  hash,
  mix,
  normalFlat,
  positionLocal,
  screenCoordinate,
  screenSize,
  screenUV,
  smoothstep,
  texture,
  time,
  uv,
  vec2,
  vec3,
  vec4,
  viewportSharedTexture,
} from 'three/tsl';
import {
  BufferAttribute,
  Color,
  HalfFloatType,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Vector2,
  Vector3,
} from 'three/webgpu';

export function createCollapseResources(width: number, height: number) {
  // These are CPU descriptors until the committed frame captures the sheet.
  const target = new RenderTarget(1600, Math.round((1600 * height) / width), {
    type: HalfFloatType,
  });
  target.texture.name = 'FramedAnnouncement';
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 200);
  return {
    target,
    camera,
    clearColor: new Color(),
    point: new Vector3(),
    edge: new Vector3(),
    previous: new Vector3(),
    scale: new Vector3(),
  };
}

export function createCollapseGeometry(width: number, height: number) {
  const plane = new PlaneGeometry(width, height, 48, 48).toNonIndexed();
  const positions = plane.attributes.position;
  const piece = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i += 3) {
    const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
    const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    // Orders stay below 0.9 so the corners are gone before the hole snaps shut
    const order =
      (Math.hypot((x * 2) / width, (y * 2) / height) / Math.SQRT2) * 0.6 +
      (noise - Math.floor(noise)) * 0.3;
    for (let vertex = i; vertex < i + 3; vertex++) piece.set([x, y, order], vertex * 3);
  }
  plane.setAttribute('piece', new BufferAttribute(piece, 3));
  return plane;
}

export function createCollapseUniforms() {
  return {
    lift: uniform(0),
    fold: uniform(0),
    tear: uniform(0),
    shake: uniform(0),
    shrink: uniform(1),
    spin: uniform(0),
    heat: uniform(0),
    presence: uniform(0),
    lens: uniform(0),
    lensCenter: uniform(new Vector2(0.5, 0.5)),
    lensRadius: uniform(0.1),
    shockRadius: uniform(0),
    shockPush: uniform(0),
    ring: uniform(0),
    ringGlow: uniform(0),
    flash: uniform(0),
    warp: uniform(0),
  };
}
export type CollapseUniforms = ReturnType<typeof createCollapseUniforms>;
export type CollapseResources = ReturnType<typeof createCollapseResources>;

// TSL nodes represent shader expressions.
/* oxlint-disable typescript/no-explicit-any */
type N = any;

export function createCollapseNodes(
  u: CollapseUniforms,
  resources: CollapseResources,
  width: number,
  height: number
) {
  const piece: N = attribute('piece', 'vec3');

  // Crumple: a twist and wrinkles that tighten toward the middle, after a bow of anticipation
  const crumple = (p: N): N => {
    const distance = p.xy.div(vec2(width / 2, height / 2)).length();
    const twist = u.fold.mul(distance.mul(0.5).add(0.4));
    const x = p.x
      .mul(twist.cos())
      .sub(p.y.mul(twist.sin()))
      .mul(float(1).sub(u.fold.mul(0.25)));
    const y = p.x
      .mul(twist.sin())
      .add(p.y.mul(twist.cos()))
      .mul(float(1).sub(u.fold.mul(0.5)));
    const wrinkles = p.x
      .mul(0.54)
      .add(p.y.mul(0.23))
      .sin()
      .abs()
      .mul(3.5)
      .add(p.y.mul(0.71).sub(p.x.mul(0.18)).sin().abs().mul(2.8))
      .sub(2.8)
      .add(distance.mul(2.7).sin().mul(3))
      .mul(u.fold);
    const bow = float(1).sub(distance.min(1).pow(2)).mul(u.lift).mul(2.2);
    return vec3(x, y, wrinkles.add(bow));
  };
  const folded = crumple(positionLocal);
  const centroid = crumple(vec3(piece.xy, 0));

  // Each shard leaves in its own turn and spirals in just behind the hole
  const loose = smoothstep(0, 1, u.tear.sub(piece.z.mul(0.7)).div(0.3));
  const pull = loose.mul(loose);
  const spiral = loose.mul(piece.z.mul(3).add(2.5));
  const radial = centroid.xy.mul(float(1).sub(pull));
  const orbit = vec2(
    radial.x.mul(spiral.cos()).sub(radial.y.mul(spiral.sin())),
    radial.x.mul(spiral.sin()).add(radial.y.mul(spiral.cos()))
  );
  const shard = folded.sub(centroid).mul(float(1).sub(loose.mul(0.85)));
  const tremor = vec3(
    piece.z.mul(91).add(time.mul(61)).sin(),
    piece.z.mul(57).add(time.mul(73)).cos(),
    0
  )
    .mul(u.shake)
    .mul(loose.mul(1.5).add(0.5))
    .mul(0.35);
  const swept = vec3(orbit.mul(u.shrink), mix(centroid.z, float(6.4), pull))
    .add(shard)
    .add(tremor);

  const ink = texture(resources.target.texture, vec2(uv().x, uv().y.oneMinus()));
  const shade = normalFlat.z.abs().mul(0.3).add(normalFlat.x.mul(0.12)).add(0.66);

  const point = uv().sub(0.5).mul(2);
  const radius = point.length();
  const diskPoint = point.mul(vec2(1, 3.6));
  const diskRadius = diskPoint.length();
  const angle = atan(diskPoint.y, diskPoint.x);
  const swirl = angle.mul(3).sub(diskRadius.mul(18)).add(u.spin).sin().mul(0.24).add(0.76);
  const disk = diskRadius.sub(0.48).pow(2).mul(-85).exp().mul(swirl);
  const photonRing = radius.sub(0.24).pow(2).mul(-3400).exp();
  const halo = radius.sub(0.25).max(0).mul(-7).exp().mul(0.12);
  const glow = u.heat.mul(1.6).add(1);

  // Lens: light near the horizon comes from further out and drags around the spin.
  // A thin shock ring pushes the image ahead of it after the pop.
  const aspect = screenSize.x.div(screenSize.y);
  const offset = screenUV.sub(u.lensCenter).mul(vec2(aspect, 1));
  const reach = offset.length().max(0.0001);
  const direction = offset.div(reach);
  const proximity = reach.div(u.lensRadius);
  const bend = u.lens.mul(u.lensRadius).div(proximity.mul(proximity).add(0.3));
  const shock = u.shockPush.mul(reach.sub(u.shockRadius).pow(2).mul(-900).exp());
  const drag = u.lens.mul(1.2).div(proximity.mul(proximity).add(0.5));
  const warped = vec2(
    direction.x.mul(drag.cos()).sub(direction.y.mul(drag.sin())),
    direction.x.mul(drag.sin()).add(direction.y.mul(drag.cos()))
  );
  const sample = (dispersion: number) =>
    viewportSharedTexture(
      u.lensCenter.add(warped.mul(reach.add(bend.mul(dispersion)).add(shock)).div(vec2(aspect, 1)))
    );

  // Warp: the frame streaks radially from the vanishing point. Keeping the brightest tap
  // along each streak turns the stars into trails, with a cold shift as speed peaks.
  const fromCenter = screenUV.sub(0.5);
  const dither = hash(screenCoordinate.x.add(screenCoordinate.y.mul(4096)).toInt());
  const taps = 20;
  let smooth: N = vec3(0);
  let streak: N = vec3(0);
  for (let i = 0; i < taps; i++) {
    const along = float((i - taps / 2) / taps)
      .add(dither.div(taps))
      .mul(u.warp);
    const tap = viewportSharedTexture(screenUV.sub(fromCenter.mul(along))).rgb;
    smooth = smooth.add(tap);
    streak = streak.max(tap);
  }
  const trails = mix(smooth.div(taps), streak, u.warp.mul(2.5).clamp().mul(0.6));

  const wave = point.length().sub(u.ring).pow(2).mul(-1400).exp().mul(u.ringGlow);
  const burst = point.length().pow(2).mul(-14).exp().mul(u.flash);

  return {
    warpVertex: vec4(positionLocal.xy.mul(2), 0, 1),
    position: swept,
    paper: mix(ink.rgb.mul(shade), color('#ffb37a'), loose.pow(3).mul(0.8)),
    paperOpacity: ink.a.mul(float(1).sub(smoothstep(0.88, 1, loose))),
    core: float(1)
      .sub(smoothstep(0.19, 0.22, radius))
      .mul(u.presence),
    light: mix(color('#ffa36a'), color('#b6adff'), point.y.mul(2).add(0.5).clamp())
      .mul(disk.mul(0.8).add(halo))
      .mul(glow)
      .add(color('#fff5dc').mul(photonRing).mul(glow).mul(1.3)),
    glow: smoothstep(0.2, 0.24, radius)
      .mul(float(1).sub(smoothstep(0.7, 1, radius)))
      .mul(u.presence),
    lensColor: vec3(sample(1).r, sample(1.1).g, sample(1.2).b),
    lensOpacity: smoothstep(0, 0.004, bend.add(shock.abs())),
    shock: color('#fff1dc').mul(wave).add(color('#ffd9b0').mul(burst)),
    shockOpacity: wave.add(burst).clamp(),
    warpColor: trails.mul(mix(vec3(1), vec3(0.9, 0.97, 1.2), u.warp.mul(4).clamp())),
    warpOpacity: u.warp.mul(25).clamp(),
  };
}
