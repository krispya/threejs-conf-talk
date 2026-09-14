import { useActiveScreen } from '../timeline/hooks.js';
import { Time } from '../time/traits.js';
import { useFrame } from '@react-three/fiber/webgpu';
import { useTrait, useWorld } from 'koota/react';
import { clamp } from 'math';
import { useMemo } from 'react';
import { atan, screenSize, screenUV, smoothstep, uniform, vec2, float } from 'three/tsl';
import { Timeline, ActiveScreen, Screen, ScreenTransition } from '../timeline/traits.js';
import { Vector2, Vector3, type Node } from 'three/webgpu';
import type { FrameStep } from '../view/hooks.js';

/**
 * The same opening reveals the destination and clips the approaching scenery.
 * The title view runs `step` in its frame callback ahead of the objects that read the opening.
 */
export function usePortal() {
  const world = useWorld();
  const { timeline, data } = useActiveScreen();
  const timing = useTrait(timeline, Timeline);
  const progress = useMemo(() => uniform(0), []);
  const radius = useMemo(() => uniform(0), []);
  const shape = useMemo(() => {
    const p = screenUV
      .sub(0.5)
      .mul(vec2(screenSize.x.div(screenSize.y), 1))
      .mul(2);
    const angle = atan(p.y, p.x);
    const distance = p.length();
    const energy = smoothstep(0, 0.12, progress);
    const ripple = angle
      .mul(7)
      .sub(progress.mul(28))
      .sin()
      .add(angle.mul(13).add(progress.mul(37)).sin().mul(0.4))
      .mul(0.018)
      .mul(progress.mul(Math.PI).sin());
    const edge = distance.sub(radius).sub(ripple);
    const aperture = smoothstep(-0.035, 0.035, edge).oneMinus().mul(energy);
    const outside = aperture.oneMinus();
    return { angle, distance, energy, edge, aperture, outside, mask: outside.greaterThan(0) };
  }, [progress, radius]);

  const step: FrameStep = (state) => {
    // Hold the opening after crossing so the old scenery cannot reappear
    /* oxlint-disable react/immutability */
    progress.value = data?.warpVisible
      ? clamp(
          (world.get(Time)!.elapsed - (timing?.startedAt ?? 0) - 1.15) /
            Math.max(0.001, (timing?.duration ?? 0) - 1.15),
          0,
          1
        )
      : data?.titleVisible
        ? 0
        : 1;
    radius.value = progress.value ** 3 * (Math.hypot(state.size.width / state.size.height, 1) + 0.5);
    /* oxlint-enable react/immutability */
  };

  return { progress, radius, step, ...shape };
}

/** Traveling compression and expansion bend the sky around the portal's world position. */
export function usePortalRipples() {
  const world = useWorld();
  const state = useMemo(
    () => ({
      elapsed: uniform(-10),
      release: uniform(2.1),
      enabled: uniform(0),
      center: uniform(new Vector2(0.5, 0.5)),
      origin: new Vector3(),
    }),
    []
  );
  const nodes = useMemo(() => {
    const aspect = vec2(screenSize.x.div(screenSize.y), 1);
    const point = screenUV.sub(state.center).mul(aspect);
    const distance = point.length();
    const direction = point.div(distance.max(0.0001));
    let push: Node<'float'> = float(0),
      twist: Node<'float'> = float(0),
      crest: Node<'float'> = float(0);
    for (let i = 0; i < 4; i++) {
      const age = state.elapsed.sub(
        i < 2 ? float(0.8 + i * 0.18) : state.release.add((i - 2) * 0.35)
      );
      const life = smoothstep(0, 0.14, age).mul(smoothstep(1.45, 2.3, age).oneMinus());
      const front = distance
        .sub(
          age
            .max(0)
            .mul(i === 0 ? 0.9 : 0.78)
            .add(0.07)
        )
        .div(0.035 + i * 0.01);
      const wave = front.pow(2).mul(-0.5).exp().mul(life);
      push = push.add(front.mul(wave).mul(i === 0 ? 0.055 : i === 1 ? 0.028 : 0.045));
      twist = twist.add(wave.mul(i === 0 ? 0.012 : i % 2 === 0 ? 0.008 : -0.008));
      crest = crest.add(wave);
    }
    const displacement = direction
      .mul(push)
      .add(vec2(direction.y.negate(), direction.x).mul(twist))
      .div(aspect)
      .mul(state.enabled);
    return {
      uv: screenUV.add(displacement),
      light: crest.mul(state.enabled).mul(0.3),
    };
  }, [state]);

  useFrame((frame) => {
    const timeline = world.queryFirst(Timeline);
    const screen = timeline?.targetFor(ActiveScreen);
    // TSL uniforms carry mutable render state outside React
    /* oxlint-disable react/immutability */
    state.enabled.value =
      screen?.get(Screen)?.initiativePortalVisible && frame.camera.position.z > 0 ? 1 : 0;
    if (!state.enabled.value) return;
    state.elapsed.value = world.get(Time)!.elapsed - timeline!.get(Timeline)!.startedAt;
    state.release.value = screen!.get(ScreenTransition)!.cameraDelay - 0.5;
    frame.camera.updateMatrixWorld();
    state.origin.set(0, 0, 0).project(frame.camera);
    state.center.value.set(0.5 + state.origin.x * 0.5, 0.5 - state.origin.y * 0.5);
    /* oxlint-enable react/immutability */
  });

  return nodes;
}
