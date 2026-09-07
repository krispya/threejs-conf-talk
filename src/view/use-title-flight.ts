import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useRef, useState } from 'react';
import { uniform } from 'three/tsl';
import { Euler, Matrix4, Quaternion, Vector3, type Group } from 'three/webgpu';
import { ActiveScreen, Screen, Time, Timeline } from '../sim/index.js';
import { packageSpring } from './package-spring.js';

/** One travel clock keeps the objects and trails continuous as the flight accelerates. */
export function useTitleFlight() {
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const timing = useTrait(timeline, Timeline);
  const [scrim] = useState(() => uniform(0));
  const [speed] = useState(() => uniform(0));
  const scenery = useRef<Group>(null);
  const shakeTransform = useRef({
    position: new Vector3(),
    rotation: new Euler(),
    quaternion: new Quaternion(),
    inverse: new Matrix4(),
  });
  const motion = useRef({
    time: 0,
    boost: 0,
    from: 0,
    target: 0,
    shake: 0,
    bump: 0,
    cruiseTime: 0,
    scrimFrom: 0,
    delay: 0,
    warp: 0,
  });
  const cruising =
    data?.id === 'warp-launch' ||
    data?.id === 'intro' ||
    !!data?.codeComparisonVisible ||
    !!data?.packageFeaturesVisible ||
    !!data?.robotVisible ||
    !!data?.warpVisible;

  useLayoutEffect(() => {
    const flight = motion.current;
    if (data?.id === 'title') {
      flight.boost = 0;
      flight.shake = 0;
      flight.bump = 0;
      flight.cruiseTime = 0;
    }
    flight.from = flight.boost;
    flight.target = data?.warpVisible ? 4 : cruising ? 1 : 0;
    if (data?.titleVisible) flight.warp = 0;
    flight.scrimFrom = scrim.value;
    flight.delay = data?.robotVisible
      ? 0.35
      : cruising && scrim.value === 0
        ? (data?.packageDelay ?? 0)
        : 0;
  }, [
    cruising,
    data?.id,
    data?.packageDelay,
    data?.robotVisible,
    data?.warpVisible,
    data?.titleVisible,
    timing,
    scrim,
  ]);

  useFrame(
    (state, delta) => {
      const flight = motion.current;
      const elapsed = world.get(Time)!.elapsed - (timing?.startedAt ?? 0);
      flight.boost = lerp(
        flight.from,
        flight.target,
        easing.cubicInOut(clamp(elapsed / (data?.warpVisible ? 0.9 : 1.2), 0, 1))
      );
      if (data?.warpVisible)
        flight.warp = clamp(elapsed / Math.max(0.001, timing?.duration ?? 0), 0, 1);
      flight.time += delta * (Math.min(1, flight.boost) + flight.boost * 7);
      // TSL uniforms hold mutable render state outside React
      // oxlint-disable-next-line react/immutability
      speed.value = flight.boost;
      const enteringPackages = cruising && data?.packageLayout === 'pair' && !data.robotVisible;
      const duration = data?.robotVisible
        ? 2.85
        : enteringPackages
          ? data.packageDuration ||
            Math.max(
              0,
              (timing?.duration ?? 0) -
                flight.delay -
                Math.max(0, data.packageNames.length - 1) * data.packageStagger
            )
          : 0.9;
      const progress = duration <= 0 ? 1 : clamp((elapsed - flight.delay) / duration, 0, 1);
      // TSL uniforms hold mutable render state outside React
      // oxlint-disable-next-line react/immutability
      scrim.value = lerp(
        flight.scrimFrom,
        cruising &&
          (data?.packagesVisible || data?.codeComparisonVisible) &&
          !data?.robotVisible &&
          !data?.warpVisible
          ? 1
          : 0,
        enteringPackages ? clamp(packageSpring(progress), 0, 1) : easing.cubicInOut(progress)
      );

      const t = world.get(Time)!.elapsed;
      if (cruising && flight.boost === 1) flight.cruiseTime += delta;
      else if (!cruising && flight.boost === 0) flight.cruiseTime = 0;
      const settled = easing.cubicInOut(clamp(flight.cruiseTime / 0.9, 0, 1));
      const shake = cruising
        ? flight.boost *
          (data?.warpVisible ? 0.05 : lerp(0.11, 0.022, settled)) *
          (1 + Math.sin(t * 0.85) * 0.15)
        : 0;
      flight.shake = lerp(flight.shake, shake, 1 - Math.exp(-delta * 14));
      // Short impacts recoil and decay while the slower cruising rumble continues.
      const bumpTime = flight.cruiseTime % 2.7;
      const bump = cruising
        ? Math.sin(bumpTime * 11) *
          Math.exp(-bumpTime * 4.5) *
          Math.cos(Math.floor(flight.cruiseTime / 2.7) * 2.4)
        : 0;
      flight.bump = lerp(flight.bump, bump, 1 - Math.exp(-delta * 22));
      const impact = flight.bump * flight.boost * 0.085;
      const { camera } = state;
      const transform = shakeTransform.current;
      transform.position.copy(camera.position);
      transform.rotation.copy(camera.rotation);
      transform.position.x +=
        lerp(
          Math.sin(t * 41) + Math.sin(t * 67) * 0.3,
          Math.sin(t * 15) + Math.sin(t * 29) * 0.3,
          settled
        ) *
          flight.shake +
        impact * 1.2;
      transform.position.y +=
        lerp(
          Math.cos(t * 47) + Math.sin(t * 73) * 0.25,
          Math.cos(t * 19) + Math.sin(t * 31) * 0.25,
          settled
        ) *
          flight.shake *
          0.7 +
        impact * 3.5;
      transform.position.z += impact * 2;
      transform.rotation.x +=
        lerp(Math.sin(t * 23), Math.sin(t * 11), settled) * 0.015 * flight.shake + impact * 0.05;
      transform.rotation.z +=
        lerp(Math.sin(t * 37), Math.sin(t * 13), settled) * 0.045 * flight.shake + impact * 0.05;

      const background = scenery.current;
      if (!background?.parent) return;
      camera.updateWorldMatrix(true, false);
      background.parent.updateWorldMatrix(true, false);
      transform.quaternion.setFromEuler(transform.rotation);
      transform.inverse.compose(transform.position, transform.quaternion, camera.scale);
      if (camera.parent) transform.inverse.premultiply(camera.parent.matrixWorld);
      transform.inverse.invert();
      // Inverse camera motion moves only the flight scenery behind the foreground.
      background.matrix
        .copy(background.parent.matrixWorld)
        .invert()
        .multiply(camera.matrixWorld)
        .multiply(transform.inverse)
        .multiply(background.parent.matrixWorld);
      background.matrixWorldNeedsUpdate = true;
    },
    { priority: -0.1 }
  );

  return {
    motion,
    scrim,
    speed,
    scenery,
    robotVisible: data?.robotVisible ?? false,
    warpVisible: data?.warpVisible ?? false,
  };
}
