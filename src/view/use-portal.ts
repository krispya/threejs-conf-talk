import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp } from 'math';
import { useMemo, useState } from 'react';
import { atan, screenSize, screenUV, smoothstep, uniform, vec2 } from 'three/tsl';
import { ActiveScreen, Screen, Time, Timeline } from '../sim/index.js';

/** The same opening reveals the destination and clips the approaching scenery. */
export function usePortal() {
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const timing = useTrait(timeline, Timeline);
  const [progress] = useState(() => uniform(0));
  const [radius] = useState(() => uniform(0));
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

  useFrame(
    (state) => {
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
      radius.value =
        progress.value ** 3 * (Math.hypot(state.size.width / state.size.height, 1) + 0.5);
      /* oxlint-enable react/immutability */
    },
    { priority: -0.7 }
  );

  return { progress, radius, ...shape };
}
