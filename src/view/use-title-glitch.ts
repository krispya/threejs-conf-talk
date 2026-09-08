import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useMemo, useRef } from 'react';
import {
  cameraProjectionMatrix,
  hash,
  mix,
  modelViewMatrix,
  positionLocal,
  screenDPR,
  screenUV,
  uniform,
  vec2,
  vec4,
  viewport,
} from 'three/tsl';
import { ActiveScreen, Screen, Timeline } from '../sim/index.js';

/** A rolling tape disturbance breaks into short digital slices, then settles. */
export function useTitleGlitch() {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const idle = useTrait(screen, Screen)?.id === 'title';
  const clock = useRef({ next: 0, start: -1, direction: 1, center: 0.5 });
  const effect = useMemo(() => {
    const active = uniform(0);
    const center = uniform(0.5);
    const width = uniform(0.012);
    const shift = uniform(0);
    const chroma = uniform(0);
    const digital = uniform(0);
    const tick = uniform(0);
    const band = screenUV.y.sub(center).abs().lessThan(width);
    const companion = screenUV.y.sub(center.add(0.095)).abs().lessThan(width.mul(0.35));
    const mask = band.or(companion).and(active.greaterThan(0));
    const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
    const offset = shift.mul(screenDPR).mul(2).div(viewport.z).mul(clip.w);
    const separation = chroma.mul(screenDPR).mul(2).div(viewport.z).mul(clip.w);
    const rows = screenUV.y.mul(viewport.w).div(screenDPR).floor();
    const scanlines = rows.mod(3).equal(0).select(0.72, 1);
    const blocks = hash(screenUV.mul(vec2(48, 140)).floor().add(tick)).greaterThan(0.9);
    return {
      active,
      center,
      width,
      shift,
      chroma,
      digital,
      tick,
      mask,
      signal: mix(scanlines, blocks.select(0.12, 1), digital),
      vertex: vec4(clip.x.add(offset), clip.yzw),
      echoVertex: vec4(clip.x.add(offset).add(separation), clip.yzw),
      cyanVertex: vec4(clip.x.add(offset).sub(separation), clip.yzw),
    };
  }, []);

  useFrame(
    (state) => {
      // TSL uniforms carry mutable shader state outside React.
      /* oxlint-disable react/immutability */
      effect.active.value = 0;
      const timing = clock.current;
      if (!idle) {
        timing.next = 0;
        timing.start = -1;
        return;
      }
      if (timing.next === 0) timing.next = state.elapsed + 4 + Math.random() * 3;
      if (state.elapsed >= timing.next) {
        timing.start = state.elapsed;
        timing.next = state.elapsed + 5 + Math.random() * 4;
        timing.direction = Math.random() < 0.5 ? -1 : 1;
        timing.center = 0.3 + Math.random() * 0.3;
      }
      const elapsed = state.elapsed - timing.start;
      if (timing.start < 0 || elapsed > 0.48) return;
      effect.tick.value = Math.floor(elapsed * 30);
      if (elapsed < 0.26) {
        const strength = Math.sin((elapsed / 0.26) * Math.PI);
        effect.active.value = 1;
        effect.digital.value = 0;
        effect.center.value = timing.center + elapsed * 0.3;
        effect.width.value = 0.018;
        effect.shift.value = Math.sin(elapsed * 58) * strength * 2.5;
        effect.chroma.value = strength * 2.2;
      } else {
        const burst = elapsed - 0.26;
        effect.active.value = burst < 0.075 || (burst > 0.115 && burst < 0.19) ? 1 : 0;
        effect.digital.value = 1;
        effect.center.value = Math.floor((timing.center + (burst < 0.075 ? 0.08 : 0.02)) * 60) / 60;
        effect.width.value = burst < 0.075 ? 0.014 : 0.008;
        effect.shift.value = timing.direction * (burst < 0.075 ? 7 : -4);
        effect.chroma.value = burst < 0.075 ? 3 : 1.5;
      }
      /* oxlint-enable react/immutability */
    },
    { priority: -0.5 }
  );

  return effect;
}
