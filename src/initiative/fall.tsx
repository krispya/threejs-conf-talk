import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { clamp } from 'math';
import { useMemo, useRef } from 'react';
import {
  float,
  hash,
  mix,
  positionLocal,
  screenCoordinate,
  screenUV,
  texture,
  uniform,
  vec4,
  viewportSharedTexture,
} from 'three/tsl';
import { Vector2, Vector3, type Mesh } from 'three/webgpu';
import { Time } from '../time/traits.js';
import {
  ActiveScreen,
  PreviousScreen,
  Screen,
  ScreenTransition,
  Timeline,
} from '../timeline/traits.js';

// TSL nodes represent shader expressions.
/* oxlint-disable typescript/no-explicit-any */
type N = any;

function createPortalFallNodes() {
  const center = uniform(new Vector2(0.5, 0.5));
  const streak = uniform(0);
  // Each pixel gathers the frame between it and the opening, keeping the brightest tap so lights become trails
  const toward = screenUV.sub(center);
  const dither = hash(screenCoordinate.x.add(screenCoordinate.y.mul(4096)).toInt());
  const taps = 16;
  const along = (tap: number) =>
    screenUV.sub(
      toward.mul(
        float(tap / taps)
          .add(dither.div(taps))
          .mul(streak)
      )
    );
  // Each viewport node copies the framebuffer and breaks the render pass, so one copy feeds every tap
  const frame = viewportSharedTexture(along(0));
  let sum: N = frame.rgb;
  let brightest: N = frame.rgb;
  for (let tap = 1; tap < taps; tap++) {
    const sample = texture(frame.value, along(tap)).rgb;
    sum = sum.add(sample);
    brightest = brightest.max(sample);
  }
  const trails = mix(sum.div(taps), brightest, streak.mul(2).clamp().mul(0.5));
  return {
    center,
    streak,
    vertex: vec4(positionLocal.xy.mul(2), 0, 1),
    color: trails,
  };
}

/**
 * The fall into the stone portal streaks the frame toward the opening, longer as the camera drops faster, and the
 * streaks settle once the camera is through so the glade comes to rest.
 */
export function PortalFall() {
  const world = useWorld();
  const pass = useMemo(() => createPortalFallNodes(), []);
  const passRef = useRef(pass);
  const mesh = useRef<Mesh>(null);
  const origin = useMemo(() => new Vector3(), []);
  // The world time the camera passed through the portal's plane
  const crossed = useRef<number | null>(null);

  useFrame((state) => {
    if (!mesh.current) return;
    const timeline = world.queryFirst(Timeline);
    const screen = timeline?.targetFor(ActiveScreen);
    const data = screen?.get(Screen);
    const timing = timeline?.get(Timeline);
    const now = world.get(Time)!.elapsed;
    const elapsed = now - (timing?.startedAt ?? 0);
    const depth = state.camera.position.z;
    let streak = 0;
    if (data?.initiativePortalVisible && timing) {
      // The camera drops with the square of the fall, so its speed and the streaks grow with the fall itself
      const delay = screen!.get(ScreenTransition)!.cameraDelay;
      streak = 0.3 * clamp((elapsed - delay) / Math.max(0.001, timing.duration - delay), 0, 1);
      // The opening sits at PMNDRS's world position until the camera passes through it
      if (depth > 0) {
        crossed.current = null;
        state.camera.updateMatrixWorld();
        origin.set(0, 0, 0).project(state.camera);
        passRef.current.center.value.set(0.5 + origin.x * 0.5, 0.5 - origin.y * 0.5);
      } else {
        if (crossed.current === null) crossed.current = now;
        passRef.current.center.value.set(0.5, 0.5);
      }
    } else if (
      !data?.initiativesVisible ||
      !screen?.targetFor(PreviousScreen)?.get(Screen)?.initiativePortalVisible
    ) {
      crossed.current = null;
    }
    // Past the plane the streaks settle across the change of screen, so the glade comes to rest
    // rather than cutting to still
    if (crossed.current !== null) {
      const settling = 0.3 * Math.exp(-(now - crossed.current) * 5);
      streak = data?.initiativePortalVisible ? Math.min(streak, settling) : settling;
    }
    passRef.current.streak.value = streak;
    mesh.current.visible = streak > 0.001;
  });

  return (
    <mesh ref={mesh} name="portal-fall" renderOrder={50} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        vertexNode={pass.vertex}
        colorNode={pass.color}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
