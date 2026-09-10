import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  atan,
  color,
  lights,
  mix,
  normalView,
  positionLocal,
  smoothstep,
  texture,
  uniform,
  uv,
} from 'three/tsl';
import {
  AdditiveBlending,
  Box3,
  Euler,
  Group,
  Matrix4,
  MeshStandardNodeMaterial,
  PointLight,
  SpotLight,
  type Mesh,
  type MeshStandardMaterial,
  type Node,
} from 'three/webgpu';
import { ActiveScreen, communityDepartureTime, Screen, Time, Timeline } from '../../sim/index.js';
import { teamLayout } from '../../sim/team-layout.js';
import { brand } from '../../theme.js';
import { withMeshopt } from '../load-gltf.js';
import { warmUp } from '../warm-up.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useLoader.preload(GLTFLoader, './meshes/robot_emoji_apple/scene.glb', withMeshopt);

/**
 * Two arms winding out of the pupil, the classic hypnotist's spiral. Held clear of the eye
 * itself and thinning as it turns away, so it reads as something the robot is projecting.
 */
function hypnoticSpiral(strength: Node<'float'>, spin: Node<'float'>, spread: Node<'float'>) {
  const point = uv().sub(0.5).mul(2);
  const radius = point.length();
  const wave = atan(point.y, point.x).mul(2).sub(radius.mul(13)).add(spin).sin().mul(0.5).add(0.5);
  // A narrow threshold keeps the arms as fine as the old falloff but with a defined edge,
  // and the threshold widens as an arm winds away so its tail dissolves instead of stopping
  const half = smoothstep(0.22, 0.8, radius).mul(0.28).add(0.04);
  const bands = smoothstep(half.negate().add(0.84), half.add(0.84), wave);
  // The arms unwind out of the pupil: their outer edge starts inside the eye and travels out
  const front = spread.mul(0.86).add(0.06);
  const reach = smoothstep(0.12, 0.3, radius)
    .mul(smoothstep(front, front.sub(0.62), radius))
    .mul(radius.mul(-1.3).exp());
  return bands.mul(reach).mul(strength).mul(1.5);
}

/** The title rises into light while the community reveal starts with eyes in darkness. */
export function RobotReveal({ variant = 'title' }: { variant?: 'title' | 'community' }) {
  const community = variant === 'community';
  const gltf = useLoader(GLTFLoader, './meshes/robot_emoji_apple/scene.glb', withMeshopt);
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const visible = (community ? data?.communityRobotVisible : data?.robotVisible) ?? false;
  const warping = !community && (data?.warpVisible ?? false);
  const team = community && !!data?.robotFriendly;
  const charterFocus = useTransitionOpacity(community && !!data?.charterFocus, {
    duration: 2.2,
    ease: easing.cubicInOut,
  });
  const friendly = useTransitionOpacity(team, {
    duration: 1.25,
    delay: team ? data.robotJoinDelay : visible ? 0 : 0.8,
    ease: easing.cubicInOut,
  });
  const joining = useTransitionOpacity(team, {
    duration: 2.1,
    delay: team ? data.robotJoinDelay : visible ? 0 : 0.8,
    ease: easing.cubicInOut,
  });
  const timing = useTrait(timeline, Timeline);
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const warmed = useRef(false);
  const motion = useRef({ value: 0, from: 0, target: 0, rise: 0, exitY: 0 });
  const [opacity] = useState(() => uniform(0));
  const [eyes] = useState(() => uniform(0));
  const [fault] = useState(() => uniform(0));
  const [laser] = useState(() => uniform(0));
  const beams = useRef<(Group | null)[]>([null, null]);
  const shot = useRef({ cycle: -1, angle: 0 });
  const [flare] = useState(() => uniform(0));
  const [swirl] = useState(() => uniform(0));
  const [spin] = useState(() => uniform(0));
  const [spread] = useState(() => uniform(0));
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const materials: MeshStandardNodeMaterial[] = [];
    const lighting = new Group();
    lighting.matrixAutoUpdate = false;
    const uplight = new SpotLight('#7fdfff', 8, 0, 0.72, 0.25, 0);
    uplight.position.set(-1.8, -4.5, 3);
    uplight.target.position.set(0, 0.7, 1.6);
    uplight.castShadow = true;
    uplight.shadow.mapSize.set(2048, 2048);
    uplight.shadow.bias = -0.0001;
    uplight.shadow.radius = 1.5;
    const rim = new PointLight(brand.orange, 3, 0, 0);
    rim.position.set(4, 1, 0.4);
    const fill = new PointLight(brand.purple, 0.25, 0, 0);
    fill.position.set(2, -3, 4);
    lighting.add(uplight, uplight.target, rim, fill);
    const illumination = lights([uplight, rim, fill]);
    scene.rotation.y = -Math.PI / 2;
    scene.position.y = -2.2;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const original = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ) as MeshStandardMaterial;
      const surface = original.map ? texture(original.map).rgb : color('#e8e3d6');
      const material = new MeshStandardNodeMaterial({
        color: '#485361',
        metalness: 0.7,
        roughness: 0.32,
        transparent: true,
        toneMapped: false,
      });
      material.opacityNode = opacity;
      material.colorNode = mix(color('#485361'), surface, friendly);
      // The teammate keeps its texture colors with only a soft hint of shape at the edges
      material.emissiveNode = surface.mul(normalView.z.clamp(0, 1).mul(0.15).add(0.85)).mul(friendly);
      material.lightsNode = illumination;
      material.envNode = color('#05070f').mul(friendly.oneMinus());
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = -12;
      materials.push(material);
    });
    const bounds = new Box3()
      .setFromObject(scene)
      .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(0.16, -0.05, -0.015)));
    return {
      scene,
      materials,
      bounds,
      lighting,
      uplight,
      rim,
      fill,
    };
  }, [gltf, opacity, friendly]);
  useEffect(
    () => () => {
      model.materials.forEach((material) => material.dispose());
      model.uplight.dispose();
    },
    [model]
  );

  useLayoutEffect(() => {
    const entering = visible && motion.current.target === 0;
    motion.current.from = motion.current.value;
    motion.current.target = visible ? 1 : 0;
    motion.current.exitY = head.current?.position.y ?? 0;
    if (entering) motion.current.rise = 0;
  }, [visible, warping, timing, community]);

  useFrame(
    (state) => {
      if (!root.current || !head.current) return;
      if (community && data?.profilesVisible && !warmed.current && state.renderer.hasInitialized()) {
        void warmUp(state.renderer, root.current, state.camera, state.scene);
        warmed.current = true;
      }
      const now = world.get(Time)!.elapsed;
      const elapsed = now - (timing?.startedAt ?? 0);
      const revealElapsed =
        community && data?.communityDeparture
          ? Math.min(
              elapsed,
              Math.max(0, communityDepartureTime(now - (timing?.departureStartedAt ?? now)) - 3.5)
            )
          : elapsed;
      const reveal = motion.current;
      reveal.value = visible
        ? 1
        : warping
          ? elapsed < 1.4
            ? reveal.from
            : 0
          : lerp(reveal.from, reveal.target, easing.cubicInOut(clamp(elapsed / 0.8, 0, 1)));
      root.current.visible = reveal.value > 0;
      if (!root.current.visible) return;
      if (visible)
        reveal.rise = Math.max(
          reveal.rise,
          clamp(community ? revealElapsed / 3.8 : (elapsed - 0.15) / 3.05, 0, 1)
        );
      // The eyes and face share their final framing throughout the reveal from darkness.
      const rise = community ? 1 : easing.cubicOut(reveal.rise);
      const depth = community ? lerp(-100, -11, joining.value) : -1800;
      const framing = state.viewport.getCurrentViewport(state.camera, [0, 0, depth]);
      // The team stays in place when the camera leaves for the stars.
      const cameraZ = team ? -5 : state.camera.position.z;
      if (team) {
        const fov = 'fov' in state.camera ? state.camera.fov : 45;
        framing.height = 2 * Math.abs(cameraZ - depth) * Math.tan((fov * Math.PI) / 360);
        framing.width = (framing.height * state.size.width) / state.size.height;
      }
      // Account for the face projecting forward from the model's center as it grows.
      const size = (framing.width * 1.22) / (4.1 + (framing.width / (cameraZ - depth)) * 2.3 * 1.22);
      // Keep the entire tilted model below the lower frustum plane before the rise.
      const belowFrame =
        -framing.height * 0.54 -
        size *
          0.9 *
          (model.bounds.max.y - (model.bounds.min.z * framing.height) / (2 * (cameraZ - depth)));
      const fit = Math.min(1, framing.width / framing.height / 1.5);
      const teamSize =
        (framing.height * teamLayout.radius * fit * lerp(1, 0.5, charterFocus.value)) /
        (model.bounds.max.y - model.bounds.min.y);
      const floatTime = now * 0.42 + 4.8;
      const floatAmplitude = framing.height * 0.0175;
      const scale = lerp(size * lerp(0.9, 1, rise), teamSize, joining.value);
      head.current.scale.setScalar(scale);
      head.current.position.set(
        lerp(
          Math.sin(now * 0.12) * size * 0.0015,
          framing.height * 0.5 * teamLayout.robot[0] * fit * lerp(1, 0.8, charterFocus.value) +
            Math.sin(floatTime * 0.7) * floatAmplitude,
          joining.value
        ),
        lerp(
          lerp(belowFrame, framing.height * 0.05, rise) + Math.sin(now * 0.18) * size * 0.0015,
          framing.height * 0.5 * teamLayout.robot[1] * lerp(1, 0.4, charterFocus.value) -
            ((model.bounds.min.y + model.bounds.max.y) / 2) * teamSize +
            Math.sin(floatTime) * floatAmplitude,
          joining.value
        ),
        depth + Math.cos(floatTime * 0.5) * floatAmplitude * 0.5 * joining.value
      );
      head.current.rotation.set(
        lerp(lerp(0.16, 0.1, rise), Math.sin(floatTime * 0.6) * 0.06, friendly.value),
        lerp(lerp(-0.05, -0.025, rise), Math.cos(floatTime * 0.4) * 0.06, friendly.value),
        lerp(-0.015, 0.04 + Math.sin(floatTime * 0.8) * 0.06, friendly.value)
      );
      if (warping) {
        const approach = easing.cubicIn(clamp(elapsed / 1.05, 0, 1));
        const fall = easing.cubicIn(clamp((elapsed - 0.9) / 0.5, 0, 1));
        head.current.position.y = lerp(reveal.exitY, belowFrame * 1.3, fall);
        head.current.position.z +=
          Math.max(0, state.camera.position.z - depth - size * model.bounds.max.z) * 0.72 * approach;
        head.current.rotation.x += fall * 0.2;
      }
      // A private light rig follows the head without lighting the foreground packages.
      head.current.updateWorldMatrix(true, false);
      model.lighting.matrix.copy(head.current.matrixWorld);
      model.lighting.updateMatrixWorld(true);
      // Shadow cameras and TSL uniforms hold mutable render state outside React.
      /* oxlint-disable react/immutability */
      model.uplight.shadow.camera.near = scale * 0.5;
      model.uplight.shadow.camera.far = scale * 12;
      model.uplight.shadow.camera.updateProjectionMatrix();
      model.uplight.shadow.normalBias = scale * 0.0015;
      const face = community ? easing.cubicInOut(clamp((reveal.rise * 3.8 - 1.6) / 1.8, 0, 1)) : 1;
      const ignition = easing.cubicOut(
        clamp(community ? (reveal.rise * 3.8 - 0.45) / 0.65 : (reveal.rise - 0.55) / 0.22, 0, 1)
      );
      const flash = Math.sin(
        clamp(community ? (reveal.rise * 3.8 - 0.65) / 0.6 : (reveal.rise - 0.6) / 0.2, 0, 1) *
          Math.PI
      );
      model.uplight.intensity = 8 * face * (1 - friendly.value);
      model.rim.intensity = 3 * face * (1 - friendly.value);
      model.fill.intensity = 0.25 * face * (1 - friendly.value);
      for (const material of model.materials) {
        material.metalness = lerp(0.7, 0, friendly.value);
        material.roughness = lerp(0.32, 1, friendly.value);
      }
      // A brief double flicker interrupts long friendly holds after the robot joins the network.
      const awake = elapsed - (data?.robotJoinDelay ?? 0) - 3.6;
      const cycle = awake % 7.6;
      const network =
        community && data?.id === 'maintainer-team' && joining.value > 0.99 && awake >= 0;
      const flicker =
        network && (cycle < 0.14 || (cycle > 0.4 && cycle < 0.51))
          ? friendly.value * reveal.value
          : 0;
      const burst = Math.floor(awake / 7.6);
      if (!network) shot.current.cycle = -1;
      else if (shot.current.cycle !== burst) {
        shot.current.cycle = burst;
        shot.current.angle = Math.random() * Math.PI * 2;
      }
      // Each second blink fires parallel rays in a shared direction for this burst.
      const age = cycle - 0.4;
      laser.value =
        network && age >= 0 && age < 0.42
          ? clamp(age / 0.035, 0, 1) * (1 - easing.cubicIn(clamp((age - 0.16) / 0.26, 0, 1)))
          : 0;
      for (let index = 0; index < beams.current.length; index++) {
        const beam = beams.current[index];
        if (!beam) continue;
        beam.visible = laser.value > 0;
        beam.rotation.set(0, 0.2, shot.current.angle, 'ZYX');
        beam.scale.x =
          ((framing.width + framing.height) / Math.max(scale, 0.001)) *
          easing.cubicOut(clamp(age / 0.12, 0, 1));
      }
      fault.value = Math.max(flicker, laser.value * friendly.value * reveal.value);
      opacity.value = face * reveal.value;
      eyes.value = Math.max(
        ignition * reveal.value * (0.94 + Math.sin(now * 1.4) * 0.06) * (1 - friendly.value),
        fault.value
      );
      flare.value =
        (ignition * 0.12 + flash * 0.88) * reveal.value * (1 - friendly.value) + fault.value * 0.3;
      // The hypnosis winds out of the pupils a beat after the eyes ignite, and drops when the
      // robot turns friendly
      swirl.value = community ? reveal.value * (1 - friendly.value) : 0;
      spread.value = community ? easing.cubicInOut(clamp((reveal.rise * 3.8 - 1.8) / 1.4, 0, 1)) : 0;
      spin.value = now * 1.9;
      /* oxlint-enable react/immutability */
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name={community ? 'community-robot' : 'robot-reveal'} visible={false}>
      <group
        ref={head}
        name={community ? 'community-robot-head' : 'robot-head'}
        position={[0, -1500, -1800]}
      >
        <primitive object={model.scene} dispose={null} />
        {community && (
          <group
            name="robot-team-center"
            position={[
              (model.bounds.min.x + model.bounds.max.x) / 2,
              (model.bounds.min.y + model.bounds.max.y) / 2,
              (model.bounds.min.z + model.bounds.max.z) / 2,
            ]}
          />
        )}
        {[-1.04, 1.06].map((x, index) => (
          <group key={x} name={`robot-eye-${index}`} position={[x, 0.26, 2.28]}>
            {community && (
              <mesh name={`robot-eye-halo-${index}`} renderOrder={-11} position={[0, 0, 0.01]}>
                <planeGeometry args={[3.6, 3.6]} />
                <meshBasicNodeMaterial
                  color="#ff1608"
                  opacityNode={uv()
                    .sub(0.5)
                    .mul(2)
                    .length()
                    .pow(2)
                    .mul(-7)
                    .exp()
                    .mul(smoothstep(1, 0.65, uv().sub(0.5).mul(2).length()))
                    .mul(fault)
                    .mul(0.72)}
                  transparent
                  depthTest={false}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            )}
            <mesh renderOrder={-11}>
              <circleGeometry args={[0.22, 48]} />
              <meshBasicNodeMaterial
                colorNode={color(community ? '#ff2014' : '#ffd8c5').mul(1.5)}
                positionNode={positionLocal.mul(fault.mul(0.5).add(1))}
                opacityNode={eyes.mul(smoothstep(1, 0.78, uv().sub(0.5).mul(2).length()))}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh renderOrder={-11} position={[0, 0, 0.02]}>
              <planeGeometry args={[2.8, 2.8]} />
              <meshBasicNodeMaterial
                color="#ff3426"
                opacityNode={uv()
                  .sub(0.5)
                  .mul(2)
                  .length()
                  .mul(mix(-9, -5, fault))
                  .exp()
                  .mul(smoothstep(1, 0.65, uv().sub(0.5).mul(2).length()))
                  .mul(eyes)
                  .mul(fault.mul(1.8).add(2.2))}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {community && (
              <mesh renderOrder={-11} position={[0, 0, 0.03]}>
                <planeGeometry args={[2.2, 2.2]} />
                <meshBasicNodeMaterial
                  color="#ffa878"
                  opacityNode={hypnoticSpiral(swirl, spin, spread)}
                  blending={AdditiveBlending}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            )}
            <mesh renderOrder={-11} position={[0, 0, 0.04]}>
              <planeGeometry args={[8, 0.24]} />
              <meshBasicNodeMaterial
                color="#ff5b41"
                opacityNode={uv()
                  .sub(0.5)
                  .mul(2)
                  .abs()
                  .oneMinus()
                  .clamp()
                  .pow(2)
                  .x.mul(uv().y.sub(0.5).abs().mul(-18).exp())
                  .mul(flare)}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {community && (
              <group
                ref={(group) => {
                  beams.current[index] = group;
                }}
                name={`robot-laser-${index}`}
                position={[0, 0, 0.12]}
                visible={false}
              >
                <mesh position={[0.5, 0, 0]} scale={[1, 0.38, 1]} renderOrder={12}>
                  <planeGeometry />
                  <meshBasicNodeMaterial
                    color="#ff1008"
                    opacityNode={uv().y.sub(0.5).mul(2).pow(2).mul(-5).exp().mul(laser).mul(0.8)}
                    transparent
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>
                <mesh position={[0.5, 0, 0.01]} scale={[1, 0.055, 1]} renderOrder={13}>
                  <planeGeometry />
                  <meshBasicNodeMaterial
                    color="#fff0dc"
                    opacityNode={uv().y.sub(0.5).abs().mul(2).oneMinus().mul(laser)}
                    blending={AdditiveBlending}
                    transparent
                    depthTest={false}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}
