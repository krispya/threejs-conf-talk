import { useResource, useFrameStep, useSpawnedParts, type FrameStep } from '../view/hooks.js';
import { BlackHoleParts } from './traits.js';
import { FlightRumble, type FlightSound } from './flight-rumble.js';
import {
  createCollapseUniforms,
  createCollapseNodes,
  createCollapseGeometry,
  createCollapseResources,
} from './utils/collapse.js';
import { Time } from '../time/traits.js';
import { useMutableCallback, useThree } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PerspectiveCamera,
  type WebGPURenderer,
} from 'three/webgpu';
import { ActiveScreen, PreviousScreen, Screen, Timeline } from '../timeline/traits.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import type { useTransitionOpacity } from '../transition/use-transition-opacity.js';
import { warmUp } from '../view/utils/warm-up.js';

/** Fraction of the way from `from` to `to`, clamped. */
const ramp = (t: number, from: number, to: number) => clamp((t - from) / (to - from), 0, 1);

/**
 * The framed document is captured once as a printed surface, then crumples, tears into shards that
 * spiral into a black hole, and pops. Every beat is timed in seconds from the transition start.
 */
export function DocumentCollapse(
  props: Omit<Parameters<typeof DocumentCollapseView>[0], 'resources' | 'geometry'>
) {
  const { width, height } = props;
  const [owned] = useResource(
    () => ({
      resources: createCollapseResources(width, height),
      geometry: createCollapseGeometry(width, height),
    }),
    ({ resources, geometry }) => {
      geometry.dispose();
      resources.target.dispose();
    },
    [width, height]
  );
  return owned ? <DocumentCollapseView {...props} {...owned} /> : null;
}

function DocumentCollapseView({
  sheet,
  progress,
  width,
  height,
  steps,
  resources,
  geometry,
}: {
  sheet: RefObject<Group | null>;
  progress: ReturnType<typeof useTransitionOpacity>;
  width: number;
  height: number;
  steps: Set<FrameStep>;
  resources: ReturnType<typeof createCollapseResources>;
  geometry: ReturnType<typeof createCollapseGeometry>;
}) {
  const world = useWorld();
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const group = useRef<Group>(null);
  const paperMesh = useRef<Mesh>(null);
  const hole = useRef<Group>(null);
  // The portraits orbit into the hole, so its place is shared with the profile systems
  const parts = useMemo(() => ({ hole: null as Group | null }), []);
  const bindHole = useSpawnedParts(BlackHoleParts, parts)('hole');
  const remnant = useRef<Group>(null);
  const warpMesh = useRef<Mesh>(null);
  const blastMesh = useRef<Mesh>(null);
  const embers = useRef<InstancedMesh>(null);
  const captured = useRef(false);
  const baseFov = useRef(0);
  const u = useMemo(() => createCollapseUniforms(), []);
  const mutableRef = useMutableCallback({ resources, u });
  const flight = useRef<FlightSound>({ speed: 0, kick: 0, jolt: 0, hit: -1 });

  useEffect(() => {
    captured.current = false;
  }, [resources]);
  // Compile the collapse effects and the sheet capture ahead of the transition that shows them
  useEffect(() => {
    if (group.current) void warmUp(renderer, group.current, camera, scene);
    if (sheet.current)
      void warmUp(renderer, sheet.current, resources.camera, undefined, resources.target);
  }, [renderer, camera, scene, resources, sheet]);

  const nodes = useMemo(
    () => createCollapseNodes(u, resources, width, height),
    [resources, u, width, height]
  );

  // Steps after the announcement has placed the sheet for this frame
  useFrameStep(steps, (state, delta) => {
    const { resources, u } = mutableRef.current;
    const { renderer } = state;
    // The flight's sound falls silent on any frame that does not reach the flight
    flight.current.speed = flight.current.kick = flight.current.jolt = 0;
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
    const exitingAnnouncement =
      !screen?.get(Screen)?.announcementVisible &&
      !!screen?.targetFor(PreviousScreen)?.get(Screen)?.announcementVisible;
    // Read the active screen directly so auto-advance cannot replay the collapsed sheet
    if (!exitingAnnouncement) {
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
      resources.camera.left = (-width / 2) * resources.scale.x;
      resources.camera.right = (width / 2) * resources.scale.x;
      resources.camera.top = (height / 2) * resources.scale.y;
      resources.camera.bottom = -(height / 2) * resources.scale.y;
      resources.camera.translateZ(80 * resources.scale.z);
      resources.camera.updateProjectionMatrix();
      resources.camera.updateMatrixWorld();

      captureSheet(renderer, paper, resources);
      captured.current = true;
      baseFov.current = camera.fov;
      resources.previous.copy(camera.position);
    }

    // Flight: the camera's measured speed drives the streaks, a wider field of view, and
    // the rumble, so the warp feel follows whatever curve the sim uses
    const speed = delta > 0 ? camera.position.distanceTo(resources.previous) / delta : 0;
    resources.previous.copy(camera.position);
    const warp = Math.min(1, speed / 300);
    u.warp.value = 0.26 * warp;
    flight.current.speed = warp;
    // The pop punches the lens out, and it snaps back as the flight begins
    camera.fov = baseFov.current + 22 * warp + (t >= 2.26 ? 14 * Math.exp(-(t - 2.26) * 6) : 0);
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
    // A violet ring chases the first, the whole frame whites out, and embers fly
    u.ring2.value = easing.cubicOut(ramp(t, 2.3, 2.9)) * 1.3;
    u.ring2Glow.value = t >= 2.3 ? (1 - ramp(t, 2.3, 2.9)) ** 2 : 0;
    u.blast.value = popped ? 0.85 * (1 - easing.cubicOut(ramp(t, 2.26, 2.62))) : 0;
    u.embers.value = popped ? t - 2.26 : -1;
    if (blastMesh.current) blastMesh.current.visible = u.blast.value > 0.001;
    if (embers.current) embers.current.visible = popped && t < 4;

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
    flight.current.kick = kick / 0.45;
    flight.current.jolt = jolt / 0.5;
    flight.current.hit = hit;
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
      // The core is drawn out to 0.22 of the hole plane's half size of 9
      u.lensRadius.value = Math.max(0.001, 1.98 * size * perUnit);
      u.shockRadius.value = 35 * u.ring.value * perUnit;
      u.shockPush.value = popped ? 0.1 * (1 - shock) ** 2 : 0;
    }
  });

  return (
    <group ref={group} name="announcement-collapse" visible={false}>
      <FlightRumble flight={flight} steps={steps} />
      <mesh ref={warpMesh} name="announcement-warp" renderOrder={20} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicNodeMaterial
          vertexNode={nodes.warpVertex}
          colorNode={nodes.warpColor}
          opacityNode={nodes.warpOpacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={blastMesh}
        name="announcement-blast"
        renderOrder={21}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicNodeMaterial
          vertexNode={nodes.warpVertex}
          colorNode={nodes.blastColor}
          opacityNode={nodes.blastOpacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <group ref={remnant} name="announcement-remnant">
        <mesh
          ref={paperMesh}
          name="announcement-crumpled-paper"
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
          name="announcement-black-hole-lens"
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
        <group
          ref={(group) => {
            hole.current = group;
            bindHole(group);
          }}
          name="announcement-black-hole"
          position={[0, 0, 7]}
        >
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
        <instancedMesh
          ref={embers}
          name="announcement-black-hole-embers"
          args={[undefined, undefined, 160]}
          position={[0, 0, 7.3]}
          renderOrder={11}
          frustumCulled={false}
          visible={false}
          userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicNodeMaterial
            positionNode={nodes.emberPosition}
            colorNode={nodes.emberColor}
            opacityNode={nodes.emberOpacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </instancedMesh>
        <mesh name="announcement-black-hole-shock" position={[0, 0, 7.2]} renderOrder={10}>
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

function captureSheet(
  renderer: WebGPURenderer,
  paper: Group,
  resources: ReturnType<typeof createCollapseResources>
) {
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
  } finally {
    paper.visible = shown;
    renderer.setRenderTarget(target);
    renderer.setClearColor(resources.clearColor, alpha);
    renderer.autoClear = autoClear;
  }
}
