import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useRef } from 'react';
import type { Group, MeshBasicNodeMaterial } from 'three/webgpu';
import { ActiveScreen, PackageSizing, Ref, Screen, Time, Timeline } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { packageSpring } from '../package-spring.js';

/** Feature chips follow Three's float and arrive after the packages settle. */
export function PackageFeatures({
  entity,
  timeline,
  visible,
}: {
  entity: Entity;
  timeline: Entity | undefined;
  visible: boolean;
}) {
  const world = useWorld();
  const timing = useTrait(timeline, Timeline);
  const font = useMSDF(fonts.mono);
  const root = useRef<Group>(null);
  const chips = useRef<(Group | null)[]>([]);
  const labels = useRef<(((opacity: number) => void) | null)[]>([]);
  const materials = useRef<(MeshBasicNodeMaterial | null)[]>([]);
  const motion = useRef(
    Array.from({ length: 2 }, () => ({ value: 0, from: 0, target: 0, delay: 0 }))
  );

  useLayoutEffect(() => {
    const screen = timeline?.targetFor(ActiveScreen)?.get(Screen);
    motion.current.forEach((item, index) => {
      item.from = item.value;
      item.target = visible ? 1 : 0;
      item.delay =
        visible && item.value === 0
          ? (screen?.packageDelay ?? 0) + (screen?.packageDuration ?? 0) + 0.12 + index * 0.22
          : 0;
    });
  }, [visible, timing, timeline]);

  useFrame(
    () => {
      const body = entity.get(Ref);
      if (!root.current || !body) return;
      const now = world.get(Time)!.elapsed;
      const size = entity.get(PackageSizing)!.compressed * body.scale.x;
      root.current.position.set(
        body.position.x + size + 0.4,
        body.position.y,
        body.position.z + 0.08
      );
      motion.current.forEach((item, index) => {
        const chip = chips.current[index];
        const label = labels.current[index];
        const material = materials.current[index];
        if (!chip || !label || !material) return;
        const elapsed = now - (timing?.startedAt ?? 0) - item.delay;
        const progress = clamp(elapsed / (visible ? 0.6 : 0.24), 0, 1);
        item.value = lerp(
          item.from,
          item.target,
          visible ? packageSpring(progress) : easing.cubicIn(progress)
        );
        const opacity = clamp(item.value, 0, 1);
        chip.visible = opacity > 0;
        if (material.opacity !== opacity) {
          material.opacity = opacity;
          label(opacity);
        }
        chip.scale.setScalar(lerp(0.9, 1, item.value));
        chip.position.set(
          (1 - item.value) * -0.3,
          (0.5 - index) * 0.72 + Math.sin(now * 0.4 + index) * 0.035,
          0
        );
      });
    },
    { priority: -0.55 }
  );

  return (
    <group
      ref={root}
      name="three-feature-chips"
      renderOrder={2}
      userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
    >
      {['WebGPURenderer', 'TSL'].map((label, index) => {
        const width = label.length * 0.32 * 0.62 + 0.24;
        return (
          <group
            key={label}
            ref={(group) => {
              chips.current[index] = group;
            }}
            name={`feature-${label}`}
            visible={false}
          >
            <mesh position={[width / 2, 0, 0]} renderOrder={-1}>
              <planeGeometry args={[width, 0.48]} />
              <meshBasicNodeMaterial
                ref={(material) => {
                  materials.current[index] = material;
                }}
                color="#000000"
                transparent
                opacity={0}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <TextGroup>
              <Text
                ref={(text) => {
                  labels.current[index] = text
                    ? (opacity) => text.set({ style: { ...text.style, opacity } })
                    : null;
                }}
                font={font}
                position={[0, 0.16, 0.01]}
                constraints={{ width: { mode: 'exact', size: width } }}
                layout={{ align: 'center', wrap: 'none' }}
                style={{ fontSize: 0.32, lineHeight: 1, color: '#ffffff', opacity: 0 }}
              >
                {label}
              </Text>
            </TextGroup>
          </group>
        );
      })}
    </group>
  );
}
