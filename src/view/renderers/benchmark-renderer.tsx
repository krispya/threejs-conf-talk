import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useMemo, useRef } from 'react';
import type { Group, Node } from 'three/webgpu';
import { spiderBenchmarks } from '../../data/benchmarks.js';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';
import { brand, fonts, ramp } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);

/** The spider benchmark floats over the Math footage with two measured comparisons. */
export function BenchmarkRenderer() {
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.benchmarkVisible ?? false;
  const reveal = useTransitionOpacity(visible, {
    duration: visible ? 0.8 : 0.3,
    delay: visible ? 0.2 : 0,
    clock: 'frames',
  });
  const ink = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.opacityNode = (material.opacityNode as Node<'float'> | null)?.mul(reveal) ?? reveal;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [reveal]
  );
  const root = useRef<Group>(null);
  const { spiders, math, three } = spiderBenchmarks[spiderBenchmarks.length - 1]!;

  useFrame(
    (state) => {
      if (!root.current) return;
      root.current.visible = reveal.value > 0;
      if (!root.current.visible) return;
      const { x, y, z } = state.camera.position;
      root.current.position.set(x, y, z - 6);
      const { width, height } = state.viewport.getCurrentViewport(
        state.camera,
        root.current.position
      );
      const scale = Math.min(height / 9, width / 16);
      root.current.scale.setScalar(scale);
      root.current.position.y = y - (0.55 + 0.25 * (1 - reveal.value)) * scale;
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="math-benchmark" visible={false}>
      <TextGroup material={ink} renderOrder={41}>
        <Text
          font={mono}
          position={[-5, 2.25, 0]}
          constraints={{ width: { mode: 'exact', size: 10 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.25, lineHeight: 1, color: ramp['light-25'] }}
        >
          Fable 5.1 / Same spider IK task
        </Text>
        <Text
          font={sans}
          position={[-5, 1.65, 0]}
          constraints={{ width: { mode: 'exact', size: 10 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.82, lineHeight: 1, color: ramp['light-25'] }}
        >
          Math vs Three built-ins
        </Text>
        <Text
          font={mono}
          position={[-5, -2.3, 0]}
          constraints={{ width: { mode: 'exact', size: 10 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.23, lineHeight: 1, color: ramp['light-25'] }}
        >
          {`${spiders.toLocaleString('en-US')} spiders / 60 steps per iteration`}
        </Text>
      </TextGroup>
      <BenchmarkMetric
        visible={visible}
        index={0}
        value={`${(three.time / math.time).toFixed(1)}x`}
        label="faster"
      />
      <BenchmarkMetric
        visible={visible}
        index={1}
        value={`${Math.round(three.heap / math.heap)}x`}
        label="less heap"
      />
    </group>
  );
}

function BenchmarkMetric({
  visible,
  index,
  value,
  label,
}: {
  visible: boolean;
  index: number;
  value: string;
  label: string;
}) {
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const reveal = useTransitionOpacity(visible, {
    duration: visible ? 0.75 : 0.25,
    delay: visible ? 0.55 + index * 0.18 : 0,
    clock: 'frames',
  });
  const ink = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.opacityNode = (material.opacityNode as Node<'float'> | null)?.mul(reveal) ?? reveal;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [reveal]
  );
  const root = useRef<Group>(null);

  useFrame(
    () => {
      if (!root.current) return;
      root.current.position.y = -0.2 * (1 - reveal.value);
      root.current.scale.setScalar(0.94 + 0.06 * reveal.value);
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} position={[-2.45 + index * 4.9, 0, 0]}>
      <TextGroup material={ink} renderOrder={42}>
        <Text
          font={sans}
          position={[-2.2, 0.2, 0]}
          constraints={{ width: { mode: 'exact', size: 4.4 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 1.65, lineHeight: 1, color: brand.yellow }}
        >
          {value}
        </Text>
        <Text
          font={mono}
          position={[-2.2, -1.55, 0]}
          constraints={{ width: { mode: 'exact', size: 4.4 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.34, lineHeight: 1, color: ramp['light-25'] }}
        >
          {label}
        </Text>
      </TextGroup>
    </group>
  );
}
