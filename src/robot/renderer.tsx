import { createRobotModel, createRobotEyeNodes } from './utils/resources.js';
import { useActiveScreen } from '../timeline/hooks.js';
import { Time } from '../time/traits.js';
import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import { useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { uniform } from 'three/tsl';
import { AdditiveBlending, Group } from 'three/webgpu';
import { Timeline } from '../timeline/traits.js';
import { communityDepartureTime } from '../profile/utils/motion.js';
import { teamLayout } from '../profile/utils/layout.js';
import { withMeshopt } from '../view/utils/load-gltf.js';
import { warmUp } from '../view/utils/warm-up.js';
import { useTransitionOpacity } from '../view/use-transition-opacity.js';

useLoader.preload(GLTFLoader, './meshes/robot_emoji_apple/scene.glb', withMeshopt);

/** The title rises into light while the community reveal starts with eyes in darkness. */
export function RobotReveal({ variant = 'title' }: { variant?: 'title' | 'community' }) {
  const community = variant === 'community';
  const gltf = useLoader(GLTFLoader, './meshes/robot_emoji_apple/scene.glb', withMeshopt);
  const world = useWorld();
  const { timeline, data } = useActiveScreen();
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
  const opacity = useMemo(() => uniform(0), []);
  const eyes = useMemo(() => uniform(0), []);
  const fault = useMemo(() => uniform(0), []);
  const laser = useMemo(() => uniform(0), []);
  const beams = useRef<(Group | null)[]>([null, null]);
  const shot = useRef({ cycle: -1, angle: 0 });
  const flare = useMemo(() => uniform(0), []);
  const swirl = useMemo(() => uniform(0), []);
  const spin = useMemo(() => uniform(0), []);
  const spread = useMemo(() => uniform(0), []);
  // Material numbers become part of the shader cache key, so the surface animates through
  // uniforms instead of rebuilding its shader when metalness reaches zero
  const metalness = useMemo(() => uniform(0.7), []);
  const roughness = useMemo(() => uniform(0.32), []);
  const model = useMemo(
    () => createRobotModel(gltf.scene, opacity, friendly, metalness, roughness),
    [gltf, opacity, friendly, metalness, roughness]
  );
  useEffect(
    () => () => {
      model.materials.forEach((material) => material.dispose());
      model.uplight.dispose();
    },
    [model]
  );
  // Nodes built during render are new objects every time, and a new node rebuilds its shader
  const eye = useMemo(
    () => createRobotEyeNodes(community, fault, eyes, flare, laser, swirl, spin, spread),
    [community, fault, eyes, flare, laser, swirl, spin, spread]
  );

  useLayoutEffect(() => {
    const entering = visible && motion.current.target === 0;
    motion.current.from = motion.current.value;
    motion.current.target = visible ? 1 : 0;
    motion.current.exitY = head.current?.position.y ?? 0;
    if (entering) motion.current.rise = 0;
  }, [visible, warping, timing, community]);

  useFrame((state) => {
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
      clamp(community ? (reveal.rise * 3.8 - 0.65) / 0.6 : (reveal.rise - 0.6) / 0.2, 0, 1) * Math.PI
    );
    model.uplight.intensity = 8 * face * (1 - friendly.value);
    model.rim.intensity = 3 * face * (1 - friendly.value);
    model.fill.intensity = 0.25 * face * (1 - friendly.value);
    metalness.value = lerp(0.7, 0, friendly.value);
    roughness.value = lerp(0.32, 1, friendly.value);
    // A brief double flicker interrupts long friendly holds after the robot joins the network.
    const awake = elapsed - (data?.robotJoinDelay ?? 0) - 3.6;
    const cycle = awake % 7.6;
    const network = community && data?.id === 'maintainer-team' && joining.value > 0.99 && awake >= 0;
    const flicker =
      network && (cycle < 0.14 || (cycle > 0.4 && cycle < 0.51)) ? friendly.value * reveal.value : 0;
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
  });

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
                  opacityNode={eye.halo}
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
                colorNode={eye.pupilColor}
                positionNode={eye.pupilPosition}
                opacityNode={eye.pupilOpacity}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh renderOrder={-11} position={[0, 0, 0.02]}>
              <planeGeometry args={[2.8, 2.8]} />
              <meshBasicNodeMaterial
                color="#ff3426"
                opacityNode={eye.glow}
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
                  opacityNode={eye.spiral}
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
                opacityNode={eye.flare}
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
                    opacityNode={eye.beam}
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
                    opacityNode={eye.beamCore}
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
