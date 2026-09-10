import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { useFrame } from '@react-three/fiber/webgpu';
import { useWorld } from 'koota/react';
import { type ComponentRef, useRef, useState } from 'react';
import { uniform } from 'three/tsl';
import type { Group } from 'three/webgpu';
import { Time } from '../../sim/index.js';
import { brand, fonts, ramp } from '../../theme.js';
import type { useTransitionOpacity } from '../use-transition-opacity.js';

export function InitiativeFeatureChip({
  children,
  index,
  width,
  count,
  opacity: visibility,
}: {
  children: string;
  index: number;
  width: number;
  count: number;
  opacity: ReturnType<typeof useTransitionOpacity>;
}) {
  const font = useMSDF(fonts.mono);
  const world = useWorld();
  const group = useRef<Group>(null);
  const text = useRef<ComponentRef<typeof Text>>(null);
  const entrance = useRef(0);
  const [opacity] = useState(() => uniform(0));

  useFrame(
    (_, delta) => {
      if (!group.current || !text.current) return;
      entrance.current += Math.min(delta, 1 / 30);
      const progress = Math.min(1, Math.max(0, (entrance.current - 0.35 - index * 0.18) / 0.55));
      const reveal = 1 - (1 - progress) ** 3;
      // Shader opacity follows each chip's staggered entrance and the shared label fade
      // oxlint-disable-next-line react/immutability
      opacity.value = reveal * visibility.value;
      const elapsed = world.get(Time)!.elapsed;
      group.current.visible = opacity.value > 0;
      group.current.position.y =
        ((count - 1) / 2 - index) * 0.66 -
        (1 - reveal) * 0.3 +
        Math.sin(elapsed * 0.9 + index * 1.7) * 0.035 * reveal;
      group.current.scale.setScalar(0.84 + reveal * 0.16);
      group.current.rotation.z =
        -(1 - reveal) * 0.045 + Math.sin(elapsed * 0.65 + index * 1.7) * 0.015 * reveal;
      if (text.current.style.opacity !== opacity.value) {
        text.current.set({ style: { ...text.current.style, opacity: opacity.value } });
      }
    },
    { priority: -0.7 }
  );

  return (
    <group ref={group} visible={false}>
      <mesh renderOrder={10}>
        <planeGeometry args={[width, 0.44]} />
        <meshBasicNodeMaterial
          color={brand.yellow}
          opacityNode={opacity}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-width / 2 + 0.16, 0, 0.01]} renderOrder={11}>
        <circleGeometry args={[0.04, 24]} />
        <meshBasicNodeMaterial
          color={ramp['dark-900']}
          opacityNode={opacity}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <TextGroup renderOrder={11}>
        <Text
          ref={text}
          font={font}
          position={[-width / 2 + 0.28, 0.12, 0.01]}
          constraints={{ width: { mode: 'exact', size: width - 0.4 } }}
          layout={{ wrap: 'none' }}
          style={{ fontSize: 0.24, lineHeight: 1, color: ramp['dark-900'], opacity: 0 }}
        >
          {children}
        </Text>
      </TextGroup>
    </group>
  );
}
