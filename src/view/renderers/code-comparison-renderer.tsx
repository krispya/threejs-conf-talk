import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { extend, useFrame, useLoader } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Shape, SRGBColorSpace, TextureLoader, type Group } from 'three/webgpu';
import { codeExamples } from '../../data/code-examples.js';
import { ActiveScreen, Screen, Time, Timeline } from '../../sim/index.js';
import { fonts, ramp } from '../../theme.js';
import { MeltMaterial as MeltMaterialImpl } from '../melt-material.js';

const MeltMaterial = extend(MeltMaterialImpl);

useMSDF.preload(fonts.mono);
for (const example of codeExamples) useLoader.preload(TextureLoader, `./code/${example.id}.png`);

export function CodeComparisonRenderer() {
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const timing = useTrait(timeline, Timeline);
  const visible = data?.codeComparisonVisible ?? false;
  const row = useRef<Group>(null);
  const items = useRef<(Group | null)[]>([]);
  const motion = useRef(
    Array.from({ length: 4 }, () => ({ value: 1, from: 1, target: 1, delay: 0, duration: 0 }))
  );

  useLayoutEffect(() => {
    motion.current.forEach((item, index) => {
      if (!visible && Math.abs(item.value) >= 1) {
        item.from = item.value;
        item.target = item.value;
        return;
      }
      const entering = visible && Math.abs(item.value) >= 1;
      if (entering) item.value = 1;
      item.from = item.value;
      item.target = visible
        ? 0
        : data?.id === 'intro' || data?.id === 'title' || data?.packageEntry === 'rise'
          ? 1
          : -1;
      item.delay = entering ? 0.9 + index * 0.12 : 0;
      item.duration = visible ? Math.max(0, (timing?.duration ?? 0) - item.delay) : 0.65;
    });
  }, [visible, data?.id, data?.packageEntry, timing]);

  useFrame(
    (state) => {
      if (!row.current) return;
      const { width, height } = state.viewport.getCurrentViewport(state.camera, [0, 0, 0]);
      const scale = Math.min((width * 0.92) / 16.6, (height * 0.8) / 4.8);
      row.current.scale.setScalar(scale);
      const offscreen = height / (2 * scale) + 3.2;
      const now = world.get(Time)!.elapsed;
      const elapsed = now - (timing?.startedAt ?? 0);

      motion.current.forEach((item, index) => {
        const group = items.current[index];
        if (!group) return;
        const progress = item.duration <= 0 ? 1 : clamp((elapsed - item.delay) / item.duration, 0, 1);
        item.value = lerp(
          item.from,
          item.target,
          visible ? easing.cubicOut(progress) : easing.cubicInOut(progress)
        );
        group.position.y = offscreen * item.value;
        group.visible = Math.abs(item.value) < 1;
        if (!group.visible) return;

        const floating = group.children[0];
        const drift = now * 0.4 + index * 2.4;
        floating.position.set(
          Math.sin(drift * 0.7) * (index === 1 ? 0.012 : 0.06),
          Math.sin(drift) * (index === 3 ? 0.18 : 0.12),
          Math.cos(drift * 0.5) * 0.03
        );
        floating.rotation.set(
          Math.sin(drift * 0.6) * 0.012,
          Math.cos(drift * 0.4) * (index === 1 ? 0.2 : 0.018),
          Math.sin(drift * 0.8) * (index === 1 ? 0.08 : 0.01)
        );
      });
    },
    { priority: -0.6 }
  );

  return (
    <group ref={row} name="code-comparison">
      <group
        ref={(group) => {
          items.current[0] = group;
        }}
        position={[-5, 0, 0]}
        visible={false}
        name="imperative-example"
      >
        <group name="floating-code-panel">
          <CodePanel example={codeExamples[0]} />
        </group>
      </group>
      <group
        ref={(group) => {
          items.current[1] = group;
        }}
        position={[-1.625, 0, 0.24]}
        visible={false}
        name="comparison-arrow"
      >
        <group name="floating-arrow">
          <CodeArrow />
        </group>
      </group>
      <group
        ref={(group) => {
          items.current[2] = group;
        }}
        position={[1.75, 0, 0]}
        visible={false}
        name="declarative-example"
      >
        <group name="floating-code-panel">
          <CodePanel example={codeExamples[1]} />
        </group>
      </group>
      <group
        ref={(group) => {
          items.current[3] = group;
        }}
        position={[6.95, 0, 0]}
        visible={false}
        name="example-sphere"
      >
        <group name="floating-sphere">
          <mesh>
            <sphereGeometry args={[1, 64, 48]} />
            <MeltMaterial transparent />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function CodeArrow() {
  const shape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.16, -0.045);
    shape.lineTo(0, -0.045);
    shape.lineTo(0, -0.13);
    shape.lineTo(0.17, 0);
    shape.lineTo(0, 0.13);
    shape.lineTo(0, 0.045);
    shape.lineTo(-0.16, 0.045);
    shape.closePath();
    return shape;
  }, []);

  return (
    <mesh rotation={[-0.2, -0.3, 0]} position={[0, 0, -0.05]}>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.1,
            bevelEnabled: true,
            bevelThickness: 0.015,
            bevelSize: 0.015,
            bevelSegments: 3,
            steps: 1,
          },
        ]}
      />
      <meshPhysicalNodeMaterial
        color={ramp['light-25']}
        roughness={0.3}
        metalness={0.12}
        clearcoat={0.6}
        transparent
      />
    </mesh>
  );
}

function CodePanel({ example }: { example: (typeof codeExamples)[number] }) {
  const font = useMSDF(fonts.mono);
  const texture = useLoader(TextureLoader, `./code/${example.id}.png`);
  const chipWidth = example.label.length * 0.32 * 0.62 + 0.24;
  const shape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-2.76, -1.85);
    shape.lineTo(2.76, -1.85);
    shape.quadraticCurveTo(3, -1.85, 3, -1.61);
    shape.lineTo(3, 1.61);
    shape.quadraticCurveTo(3, 1.85, 2.76, 1.85);
    shape.lineTo(-2.76, 1.85);
    shape.quadraticCurveTo(-3, 1.85, -3, 1.61);
    shape.lineTo(-3, -1.61);
    shape.quadraticCurveTo(-3, -1.85, -2.76, -1.85);
    shape.closePath();
    return shape;
  }, []);

  return (
    <>
      <mesh position={[0.06, -0.09, -0.02]}>
        <shapeGeometry args={[shape, 12]} />
        <meshBasicNodeMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh>
        <shapeGeometry args={[shape, 12]} />
        <meshBasicNodeMaterial color={ramp['dark-900']} transparent toneMapped={false} />
      </mesh>
      <group name="code-label" position={[0, 2.1, 0.03]}>
        <mesh position={[0, 0.24, 0]} renderOrder={-1}>
          <planeGeometry args={[chipWidth, 0.48]} />
          <meshBasicNodeMaterial color="#000000" transparent toneMapped={false} />
        </mesh>
        <TextGroup>
          <Text
            font={font}
            position={[-chipWidth / 2, 0.4, 0.01]}
            constraints={{ width: { mode: 'exact', size: chipWidth } }}
            layout={{ align: 'center', wrap: 'none' }}
            style={{ fontSize: 0.32, lineHeight: 1, color: '#ffffff' }}
          >
            {example.label}
          </Text>
        </TextGroup>
      </group>
      <mesh name="source-code" position={[0, 0, 0.02]}>
        <planeGeometry args={[5.4, 2.9]} />
        <meshBasicNodeMaterial
          map={texture}
          map-colorSpace={SRGBColorSpace}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
