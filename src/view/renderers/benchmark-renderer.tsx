import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useMemo, useRef } from 'react';
import type { Group, Node } from 'three/webgpu';
import { spiderBenchmarks, threeBridgeBenchmarks } from '../../data/benchmarks.js';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';
import { brand, fonts, ramp } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);

/** Measured comparisons sit inside the Math portal. */
export function BenchmarkRenderer() {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const visible = data?.benchmarkVisible ?? false;
  const bridge = data?.benchmarkVariant === 'three';
  const reveal = useTransitionOpacity(visible, {
    duration: visible ? 0.5 : 0.4,
    clock: 'frames',
  });
  const root = useRef<Group>(null);

  useFrame(
    () => {
      if (root.current) root.current.visible = reveal.value > 0;
    },
    { priority: -0.55 }
  );

  return (
    <group
      ref={root}
      name="math-benchmark"
      position={[0.107, -0.203, 0.08]}
      scale={0.25}
      visible={false}
    >
      <mesh name="benchmark-backing" renderOrder={39}>
        <circleGeometry args={[3.35, 96]} />
        <meshBasicNodeMaterial
          color="#08070d"
          opacityNode={reveal.mul(0.96)}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <BenchmarkScene visible={visible && !bridge} bridge={false} />
      <BenchmarkScene visible={visible && bridge} bridge />
    </group>
  );
}

function useBenchmarkInk(opacity: ReturnType<typeof useTransitionOpacity>) {
  return useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(opacity) ?? opacity;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [opacity]
  );
}

function BenchmarkScene({ visible, bridge }: { visible: boolean; bridge: boolean }) {
  const mono = useMSDF(fonts.mono);
  const reveal = useTransitionOpacity(visible, {
    duration: visible ? 0.45 : 0.25,
    delay: visible ? 0.25 : 0,
    clock: 'frames',
  });
  const ink = useBenchmarkInk(reveal);
  const root = useRef<Group>(null);
  const { spiders, math, three } = spiderBenchmarks[spiderBenchmarks.length - 1]!;

  useFrame(
    () => {
      if (!root.current) return;
      root.current.visible = reveal.value > 0;
      root.current.position.y = -0.12 * (1 - reveal.value);
    },
    { priority: -0.55 }
  );

  return (
    <group ref={root} name={bridge ? 'benchmark-three' : 'benchmark-spider'} visible={false}>
      <TextGroup material={ink} renderOrder={42}>
        <Text
          font={mono}
          position={[bridge ? -2 : -2.8, bridge ? 2.65 : 2.5, 0]}
          constraints={{ width: { mode: 'exact', size: bridge ? 4 : 5.6 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: bridge ? 0.25 : 0.23, lineHeight: 1, color: ramp['light-25'] }}
        >
          {bridge
            ? 'Three.js + math'
            : `Fable 5.1 / ${spiders.toLocaleString('en-US')} spider IK rigs`}
        </Text>
        {bridge && (
          <Text
            font={mono}
            position={[-2, -2.45, 0]}
            constraints={{ width: { mode: 'exact', size: 4 } }}
            layout={{ align: 'center', wrap: 'none' }}
            style={{ fontSize: 0.24, lineHeight: 1, color: ramp['light-25'] }}
          >
            faster than Three.js
          </Text>
        )}
      </TextGroup>
      {bridge ? (
        threeBridgeBenchmarks.map(({ label, count, three, math }, index) => (
          <BenchmarkMetric
            key={label}
            visible={visible}
            index={index}
            bridge
            value={`${(three / math).toFixed(1)}x`}
            label={label}
            detail={count.toLocaleString('en-US')}
            bars={[{ height: (three / math) * 0.8, color: brand.yellow }]}
          />
        ))
      ) : (
        <>
          <BenchmarkMetric
            visible={visible}
            index={0}
            heading="Average time"
            value={`${(three.time / math.time).toFixed(1)}x`}
            label="faster"
            bars={[
              { height: (math.time / three.time) * 1.85, color: brand.yellow },
              { height: 1.85, color: brand.purple },
            ]}
          />
          <BenchmarkMetric
            visible={visible}
            index={1}
            heading="Heap usage"
            value={`${Math.round(three.heap / math.heap)}x`}
            label="less heap"
            bars={[
              { height: (math.heap / three.heap) * 1.85, color: brand.yellow },
              { height: 1.85, color: brand.purple },
            ]}
          />
        </>
      )}
    </group>
  );
}

function BenchmarkMetric({
  visible,
  index,
  bridge = false,
  value,
  label,
  heading,
  detail,
  bars,
}: {
  visible: boolean;
  index: number;
  bridge?: boolean;
  value: string;
  label: string;
  heading?: string;
  detail?: string;
  bars: { height: number; color: string }[];
}) {
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const reveal = useTransitionOpacity(visible, {
    duration: visible ? 0.8 : 0.22,
    delay: visible ? 0.45 + index * 0.14 : 0,
    clock: 'frames',
  });
  const ink = useBenchmarkInk(reveal);
  const root = useRef<Group>(null);
  const columns = useRef<Group>(null);

  useFrame(
    () => {
      if (!root.current || !columns.current) return;
      root.current.visible = reveal.value > 0;
      // Scale around the baseline so each bar grows upward without moving its foot.
      columns.current.scale.y = reveal.value;
    },
    { priority: -0.55 }
  );

  return (
    <group
      ref={root}
      name={`benchmark-metric-${index}`}
      position={[bridge ? (index - 1) * 1.85 : -1.45 + index * 2.9, 0, 0]}
      visible={false}
    >
      <TextGroup material={ink} renderOrder={42}>
        {heading && (
          <Text
            font={mono}
            position={[-1.3, -2.1, 0]}
            constraints={{ width: { mode: 'exact', size: 2.6 } }}
            layout={{ align: 'center', wrap: 'none' }}
            style={{ fontSize: 0.23, lineHeight: 1, color: ramp['light-25'] }}
          >
            {heading}
          </Text>
        )}
        <Text
          font={sans}
          position={[bridge ? -0.9 : -1.3, bridge ? 1.95 : 1.7, 0]}
          constraints={{ width: { mode: 'exact', size: bridge ? 1.8 : 2.6 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: bridge ? 0.65 : 0.82, lineHeight: 1, color: brand.yellow }}
        >
          {value}
        </Text>
        <Text
          font={mono}
          position={[bridge ? -0.9 : -1.3, bridge ? -1.28 : 0.8, 0]}
          constraints={{ width: { mode: 'exact', size: bridge ? 1.8 : 2.6 } }}
          layout={{ align: 'center', wrap: 'word' }}
          style={{ fontSize: bridge ? 0.25 : 0.24, lineHeight: 1.15, color: ramp['light-25'] }}
        >
          {label}
        </Text>
        {detail && (
          <Text
            font={mono}
            position={[-0.9, -1.99, 0]}
            constraints={{ width: { mode: 'exact', size: 1.8 } }}
            layout={{ align: 'center', wrap: 'none' }}
            style={{ fontSize: 0.2, lineHeight: 1, color: ramp['light-25'] }}
          >
            {detail}
          </Text>
        )}
        {!bridge &&
          bars.map(({ color }, column) => (
            <Text
              key={color}
              font={mono}
              position={[-0.48 + column * 0.96 - 0.48, -1.65, 0]}
              constraints={{ width: { mode: 'exact', size: 0.96 } }}
              layout={{ align: 'center', wrap: 'none' }}
              style={{ fontSize: 0.22, lineHeight: 1, color }}
            >
              {column === 0 ? 'Math' : 'No Math'}
            </Text>
          ))}
      </TextGroup>
      <group
        ref={columns}
        name="benchmark-bars"
        position={[0, bridge ? -1 : -1.45, 0]}
        scale={[1, 0, 1]}
      >
        {bars.map(({ height, color }, column) => (
          <group key={color} position={[bridge ? 0 : -0.48 + column * 0.96, 0, 0]}>
            <mesh position={[0, height / 2, 0]} renderOrder={41}>
              <planeGeometry args={[bridge ? 0.8 : 0.68, height]} />
              <meshBasicNodeMaterial
                color={color}
                opacityNode={reveal}
                transparent
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
      {!bridge &&
        bars.map(({ color }, column) => (
          <mesh key={color} position={[-0.48 + column * 0.96, -1.45, 0]} renderOrder={41}>
            <planeGeometry args={[0.68, 0.018]} />
            <meshBasicNodeMaterial
              color={color}
              opacityNode={reveal}
              transparent
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
    </group>
  );
}
