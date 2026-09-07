import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { useMemo, useState } from 'react';
import { float, screenSize, screenUV, smoothstep, uniform, vec2 } from 'three/tsl';
import { Vector2, Vector3, type Node } from 'three/webgpu';
import { ActiveScreen, Screen, ScreenTransition, Time, Timeline } from '../sim/index.js';

/** Traveling compression and expansion bend the sky around the portal's world position. */
export function usePortalRipples() {
  const world = useWorld();
  const [state] = useState(() => ({
    elapsed: uniform(-10),
    release: uniform(2.1),
    enabled: uniform(0),
    center: uniform(new Vector2(0.5, 0.5)),
    origin: new Vector3(),
  }));
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

  useFrame(
    (frame) => {
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
    },
    { priority: -0.7 }
  );

  return nodes;
}
