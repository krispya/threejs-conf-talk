import { useFrame, useThree } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
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
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  viewportSharedTexture,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  HalfFloatType,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from 'three/webgpu';
import { ActiveScreen, PreviousScreen, Screen, Time, Timeline } from '../../sim/index.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import type { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';

// TSL nodes are loosely typed; `any` keeps the shader readable.
/* oxlint-disable typescript/no-explicit-any */
type N = any;

/** Fraction of the way from `from` to `to`, clamped. */
const ramp = (t: number, from: number, to: number) => clamp((t - from) / (to - from), 0, 1);

/**
 * The charter is captured once as a printed sheet, then crumples, tears into shards that
 * spiral into a black hole, and pops. Every beat is timed in seconds from the transition start.
 */
export function CharterCollapse({
  sheet,
  active,
  progress,
}: {
  sheet: RefObject<Group | null>;
  active: RefObject<boolean>;
  progress: ReturnType<typeof useTransitionOpacity>;
}) {
  const world = useWorld();
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const group = useRef<Group>(null);
  const paperMesh = useRef<Mesh>(null);
  const hole = useRef<Group>(null);
  const remnant = useRef<Group>(null);
  const warpMesh = useRef<Mesh>(null);
  const captured = useRef(false);
  const baseFov = useRef(0);
  const [resources] = useState(() => {
    // These are CPU descriptors until the committed frame captures the sheet.
    const target = new RenderTarget(1600, 1200, { type: HalfFloatType });
    target.texture.name = 'CharterPrintedSheet';
    const camera = new OrthographicCamera(-20.2, 20.2, 15.15, -15.15, 0.1, 200);
    return {
      target,
      camera,
      clearColor: new Color(),
      point: new Vector3(),
      edge: new Vector3(),
      previous: new Vector3(),
      scale: new Vector3(),
    };
  });
  const [u] = useState(() => ({
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
  }));
  useEffect(() => {
    captured.current = false;
    return () => resources.target.dispose();
  }, [resources]);
  // Compile the collapse effects and the sheet capture ahead of the transition that shows them
  useEffect(() => {
    if (group.current) warmUp(renderer, group.current, camera, scene);
    if (sheet.current) warmUp(renderer, sheet.current, resources.camera, undefined, resources.target);
  }, [renderer, camera, scene, resources, sheet]);

  // Unshared triangles let the sheet tear. Each carries its centroid and a tear order that
  // favors the middle, so the shards nearest the hole go first.
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(40.4, 30.3, 48, 36).toNonIndexed();
    const positions = plane.attributes.position;
    const piece = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i += 3) {
      const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
      const y = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
      const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      // Orders stay below 0.9 so the corners are gone before the hole snaps shut
      const order =
        (Math.hypot(x / 20.2, y / 15.15) / Math.SQRT2) * 0.6 + (noise - Math.floor(noise)) * 0.3;
      for (let vertex = i; vertex < i + 3; vertex++) piece.set([x, y, order], vertex * 3);
    }
    plane.setAttribute('piece', new BufferAttribute(piece, 3));
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const nodes = useMemo(() => {
    const piece: N = attribute('piece', 'vec3');

    // Crumple: a twist and wrinkles that tighten toward the middle, after a bow of anticipation
    const crumple = (p: N): N => {
      const distance = p.xy.div(vec2(20, 15)).length();
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
  }, [resources, u]);

  // TSL uniforms carry mutable render state outside React
  /* oxlint-disable react/immutability */
  useFrame(
    (state, delta) => {
      const view = group.current;
      const paper = sheet.current;
      if (!view || !paper) return;
      const camera = state.camera as PerspectiveCamera;
      const settle = () => {
        if (!baseFov.current) return;
        camera.fov = baseFov.current;
        camera.updateProjectionMatrix();
        baseFov.current = 0;
      };
      const timeline = world.queryFirst(Timeline);
      const screen = timeline?.targetFor(ActiveScreen);
      const exitingCharter =
        !screen?.get(Screen)?.charterVisible &&
        !!screen?.targetFor(PreviousScreen)?.get(Screen)?.charterVisible;
      // Read the active screen directly so auto-advance cannot replay the collapsed sheet
      if (!active.current || !exitingCharter) {
        captured.current = false;
        view.visible = false;
        if (remnant.current) remnant.current.visible = false;
        u.spin.value = 0;
        settle();
        return;
      }
      const timing = timeline?.get(Timeline);
      const duration = timing?.duration ?? 0;
      const t = timing ? world.get(Time)!.elapsed - timing.startedAt : 0;
      view.visible = progress.value > 0 && t < duration;
      if (!view.visible) {
        settle();
        return;
      }

      if (!captured.current) {
        view.position.copy(paper.position);
        view.quaternion.copy(paper.quaternion);
        view.scale.copy(paper.scale);
        paper.updateWorldMatrix(true, true);
        paper.getWorldPosition(resources.camera.position);
        paper.getWorldQuaternion(resources.camera.quaternion);
        paper.getWorldScale(resources.scale);
        // Frame the printed sheet at its world scale before the collapse
        resources.camera.left = -20.2 * resources.scale.x;
        resources.camera.right = 20.2 * resources.scale.x;
        resources.camera.top = 15.15 * resources.scale.y;
        resources.camera.bottom = -15.15 * resources.scale.y;
        resources.camera.translateZ(80 * resources.scale.z);
        resources.camera.updateProjectionMatrix();
        resources.camera.updateMatrixWorld();

        const target = renderer.getRenderTarget();
        const autoClear = renderer.autoClear;
        const alpha = renderer.getClearAlpha();
        const shown = paper.visible;
        renderer.getClearColor(resources.clearColor);
        try {
          paper.visible = true;
          renderer.setRenderTarget(resources.target);
          renderer.setClearColor(0x000000, 0);
          renderer.autoClear = true;
          renderer.render(paper, resources.camera);
          captured.current = true;
          baseFov.current = camera.fov;
          resources.previous.copy(camera.position);
        } finally {
          paper.visible = shown;
          renderer.setRenderTarget(target);
          renderer.setClearColor(resources.clearColor, alpha);
          renderer.autoClear = autoClear;
        }
      }

      // Flight: the camera's measured speed drives the streaks, a wider field of view, and
      // the rumble, so the warp feel follows whatever curve the sim uses
      const speed = delta > 0 ? camera.position.distanceTo(resources.previous) / delta : 0;
      resources.previous.copy(camera.position);
      const warp = Math.min(1, speed / 300);
      u.warp.value = 0.26 * warp;
      camera.fov = baseFov.current + 22 * warp;
      camera.updateProjectionMatrix();
      if (warpMesh.current) warpMesh.current.visible = warp > 0.01;
      if (remnant.current) remnant.current.visible = t < 3.1;

      // Anticipation: the sheet bows out and starts to tremble before the pull takes hold
      u.lift.value = Math.sin(ramp(t, 0, 0.7) * Math.PI);
      u.fold.value = easing.cubicInOut(ramp(t, 0.35, 1.7));
      u.tear.value = ramp(t, 0.8, 2.15);
      u.shrink.value = 1 - easing.cubicIn(ramp(t, 0.9, 2.15)) * 0.5;
      const rising = ramp(t, 0.2, 2.15);
      u.shake.value = rising * rising * (1 - ramp(t, 2.15, 2.3));
      u.spin.value += delta * (1.2 + 12 * easing.cubicIn(ramp(t, 0.3, 2.25)));
      u.heat.value = easing.cubicIn(ramp(t, 1.3, 2.2));

      // The hole grows in, swells for the wind up, squashes to a line, then pinches to nothing
      const grow = lerp(0.15, 1, easing.cubicOut(ramp(t, 0, 0.6)));
      const swell = lerp(1, 1.4, easing.cubicInOut(ramp(t, 1.85, 2.18)));
      const squash = easing.cubicIn(ramp(t, 2.18, 2.27));
      const pinch = easing.cubicIn(ramp(t, 2.25, 2.34));
      const size = grow * swell;
      const rumble = 0.08 * ramp(t, 1.3, 2.2) ** 2;
      const jitter = u.shake.value * 0.3;
      if (hole.current) {
        hole.current.scale.set(
          Math.max(0.001, size * (1 + 0.5 * squash) * (1 - pinch)),
          Math.max(0.001, size * (1 - 0.97 * squash)),
          1
        );
        hole.current.position.set(Math.sin(t * 53) * jitter, Math.cos(t * 47) * jitter, 7);
      }
      if (paperMesh.current) {
        paperMesh.current.visible = t < 2.25;
        paperMesh.current.position.set(Math.sin(t * 41) * jitter, Math.cos(t * 39) * jitter, 0);
      }
      const arrival = ramp(t, 0, 0.3);
      u.presence.value = arrival * arrival * (3 - 2 * arrival) * (1 - ramp(t, 2.3, 2.36));
      u.lens.value =
        1.2 *
        easing.cubicOut(ramp(t, 0, 0.6)) *
        (1 + 0.9 * u.heat.value) *
        (1 - easing.cubicIn(ramp(t, 2.2, 2.34)));

      // Pop: a flash and a shock ring, with a ripple through the lens riding behind it
      const popped = t >= 2.26;
      const shock = ramp(t, 2.26, 3);
      u.flash.value = popped ? 1 - easing.cubicOut(ramp(t, 2.26, 2.5)) : 0;
      u.ring.value = easing.cubicOut(shock) * 0.9;
      u.ringGlow.value = popped ? (1 - shock) ** 2 : 0;

      // The camera rumbles as the pull builds, kicks when the hole pops, then keeps a steady
      // rumble for the whole flight that surges with the warp speed and lets go on arrival
      const kick = popped ? 0.45 * (1 - ramp(t, 2.26, 2.8)) ** 2 : 0;
      const cruise = popped
        ? (0.22 * ramp(t, 2.26, 2.6) + 0.4 * warp) * (1 - ramp(t, duration - 0.15, duration))
        : 0;
      // Periodic jolts of varying strength, like a hull taking bumps at cruising speed
      const beat = (t - 2.6) / 0.45;
      const hit = Math.floor(beat);
      const seed = Math.sin(hit * 12.9898) * 43758.5453;
      const jolt =
        popped && beat > 0
          ? Math.exp(-(beat - hit) * 7) *
            (0.4 + 0.6 * (seed - Math.floor(seed))) *
            0.5 *
            (1 - ramp(t, duration - 0.15, duration))
          : 0;
      camera.position.y += jolt * Math.sin((beat - hit) * 28) * (hit % 2 ? 1 : -1);
      camera.rotation.z += jolt * 0.02 * Math.cos((beat - hit) * 22);
      const amplitude = rumble + kick + cruise;
      // The buzz runs fast and climbs with the warp so the shake reads as speed, not wobble
      const buzz = t * (1 + warp * 0.8);
      camera.position.x += (Math.sin(buzz * 79) + 0.5 * Math.sin(buzz * 173)) * amplitude * 0.7;
      camera.position.y += (Math.cos(buzz * 67 + 1) + 0.5 * Math.cos(buzz * 151)) * amplitude * 0.5;
      camera.rotation.z += Math.sin(buzz * 59) * amplitude * 0.006;
      camera.updateMatrixWorld();

      // Project the hole into screen space for the lens, in units of the viewport height
      if (hole.current) {
        const { point, edge } = resources;
        hole.current.getWorldPosition(point);
        edge.copy(point).addScaledVector(camera.up, resources.scale.y).project(camera);
        point.project(camera);
        const perUnit = Math.abs(edge.y - point.y) * 0.5;
        u.lensCenter.value.set(point.x * 0.5 + 0.5, 0.5 - point.y * 0.5);
        u.lensRadius.value = Math.max(0.001, 1.8 * size * perUnit);
        u.shockRadius.value = 35 * u.ring.value * perUnit;
        u.shockPush.value = popped ? 0.05 * (1 - shock) ** 2 : 0;
      }
    },
    { priority: -0.61 }
  );
  /* oxlint-enable react/immutability */

  return (
    <group ref={group} name="charter-collapse" visible={false}>
      <mesh ref={warpMesh} name="charter-warp" renderOrder={20} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicNodeMaterial
          vertexNode={vec4(positionLocal.xy.mul(2), 0, 1)}
          colorNode={nodes.warpColor}
          opacityNode={nodes.warpOpacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={remnant} name="charter-remnant">
        <mesh
          ref={paperMesh}
          name="charter-crumpled-paper"
          geometry={geometry}
          renderOrder={4}
          frustumCulled={false}
        >
          <meshBasicNodeMaterial
            map={resources.target.texture}
            positionNode={nodes.position}
            colorNode={nodes.paper}
            opacityNode={nodes.paperOpacity}
            side={DoubleSide}
            transparent
            depthWrite
            toneMapped={false}
          />
        </mesh>
        <mesh
          name="charter-black-hole-lens"
          position={[0, 0, 7.5]}
          renderOrder={7}
          frustumCulled={false}
          userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
        >
          <planeGeometry args={[140, 140]} />
          <meshBasicNodeMaterial
            colorNode={nodes.lensColor}
            opacityNode={nodes.lensOpacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <group ref={hole} name="charter-black-hole" position={[0, 0, 7]}>
          <mesh renderOrder={8}>
            <planeGeometry args={[18, 18]} />
            <meshBasicNodeMaterial
              color="#000000"
              opacityNode={nodes.core}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.01]} renderOrder={9} rotation={[0, 0, -0.15]}>
            <planeGeometry args={[18, 18]} />
            <meshBasicNodeMaterial
              colorNode={nodes.light}
              opacityNode={nodes.glow}
              transparent
              depthWrite={false}
              toneMapped={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
        <mesh name="charter-black-hole-shock" position={[0, 0, 7.2]} renderOrder={10}>
          <planeGeometry args={[70, 70]} />
          <meshBasicNodeMaterial
            colorNode={nodes.shock}
            opacityNode={nodes.shockOpacity}
            transparent
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
