import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useMemo, useRef } from 'react';
import { color, smoothstep } from 'three/tsl';
import { DynamicDrawUsage, type BufferAttribute, type Group, type Node } from 'three/webgpu';
import { ConnectedTo, Position, Principle } from '../../sim/index.js';
import { fonts, ramp } from '../../theme.js';
import type { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);

/** Retain the map annotations while their visibility follows the screen transition. */
export function ConstellationMap({
  stars,
  progress,
  opacity,
}: {
  stars: readonly Entity[];
  progress: ReturnType<typeof useTransitionOpacity>;
  opacity: ReturnType<typeof useTransitionOpacity>;
}) {
  const font = useMSDF(fonts.sans);
  const groupRef = useRef<Group>(null);
  const labels = useRef(new Map<Entity, Group>());
  const connections = useMemo(
    () =>
      stars.flatMap((star) => star.targetsFor(ConnectedTo).map((target) => [star, target] as const)),
    [stars]
  );
  const positions = useMemo(() => new Float32Array(connections.length * 6), [connections]);
  const attributeRef = useRef<BufferAttribute>(null);
  const lineOpacity = useMemo(
    () => smoothstep(0.05, 0.65, progress).mul(opacity).mul(0.22),
    [progress, opacity]
  );
  const labelOpacity = useMemo(
    () => smoothstep(0.2, 0.9, progress).mul(opacity),
    [progress, opacity]
  );
  const material = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color(ramp['light-25']);
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(labelOpacity) ?? labelOpacity;
        material.depthWrite = false;
        return material;
      }),
    [labelOpacity]
  );

  useFrame(
    () => {
      const group = groupRef.current;
      if (!group) return;
      group.visible = progress.value > 0 && opacity.value > 0;
      if (!group.visible) return;

      for (const [entity, label] of labels.current) {
        const position = entity.get(Position)!;
        label.position.set(position.x, position.y, position.z);
      }
      const attribute = attributeRef.current;
      if (!attribute) return;
      for (const [index, [from, to]] of connections.entries()) {
        const a = from.get(Position)!;
        const b = to.get(Position)!;
        attribute.setXYZ(index * 2, a.x, a.y, a.z);
        attribute.setXYZ(index * 2 + 1, b.x, b.y, b.z);
      }
      attribute.needsUpdate = true;
    },
    { priority: -0.6 }
  );

  return (
    <group ref={groupRef} name="star-map" visible={false}>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            ref={attributeRef}
            attach="attributes-position"
            args={[positions, 3]}
            usage={DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicNodeMaterial
          color={ramp['light-25']}
          opacityNode={lineOpacity}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <TextGroup renderOrder={2} material={material}>
        {stars.map((entity) => (
          <group
            key={entity}
            ref={(group) => {
              if (!group) return;
              labels.current.set(entity, group);
              return () => {
                labels.current.delete(entity);
              };
            }}
          >
            <Text
              font={font}
              position={[-14, -2, 0.5]}
              constraints={{ width: { mode: 'exact', size: 28 } }}
              layout={{ align: 'center', wrap: 'none' }}
              style={{ fontSize: 3.4, lineHeight: 1 }}
            >
              {entity.get(Principle)!.title}
            </Text>
          </group>
        ))}
      </TextGroup>
    </group>
  );
}
