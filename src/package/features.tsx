import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import type { Entity } from 'koota';
import type { Group, MeshBasicNodeMaterial } from 'three/webgpu';
import { FeatureParts, type GlyphLabel } from './traits.js';
import { fonts } from '../theme.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { useTraitBinding } from '../view/hooks.js';

/** Feature chips follow Three's float and arrive after the packages settle. */
export function PackageFeatures({ entity }: { entity: Entity }) {
  const font = useMSDF(fonts.mono);
  // animateFeatureChips positions and reveals the chips through these parts
  const parts = {
    root: null as Group | null,
    chips: [] as (Group | null)[],
    labels: [] as (GlyphLabel | null)[],
    materials: [] as (MeshBasicNodeMaterial | null)[],
  };
  const bind = useTraitBinding(entity, FeatureParts, parts);

  return (
    <group
      ref={bind('root')}
      name="three-feature-chips"
      renderOrder={2}
      userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
    >
      {['WebGPURenderer', 'TSL'].map((label, index) => {
        const width = label.length * 0.32 * 0.62 + 0.24;
        return (
          <group key={label} ref={bind('chips', index)} name={`feature-${label}`} visible={false}>
            <mesh position={[width / 2, 0, 0]} renderOrder={-1}>
              <planeGeometry args={[width, 0.48]} />
              <meshBasicNodeMaterial
                ref={bind('materials', index)}
                color="#000000"
                transparent
                opacity={0}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <TextGroup>
              <Text
                ref={bind('labels', index)}
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
