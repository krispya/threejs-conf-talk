import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMsdf } from '@pmndrs/glyph/react/msdf';
import type { Entity } from 'koota';
import { useTrait } from 'koota/react';
import type { Group, MeshBasicNodeMaterial } from 'three/webgpu';
import { DownloadParts, Package, type GlyphLabel } from './traits.js';
import { fonts } from '../theme.js';
import { downloadsLabel } from './utils/sizing.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { useTraitBinding } from '../view/hooks.js';

/** Count the same download snapshot that determines the sphere's area. */
export function PackageDownloads({ entity }: { entity: Entity }) {
  const { downloads } = useTrait(entity, Package)!;
  const font = useMsdf(fonts.mono);
  const width = downloadsLabel(downloads).length * 0.32 * 0.62 + 0.24;
  // animateDownloadCounters raises, counts, and settles the ticker through these parts
  const parts = {
    group: null as Group | null,
    number: null as GlyphLabel | null,
    backdrop: null as MeshBasicNodeMaterial | null,
  };
  const bind = useTraitBinding(entity, DownloadParts, parts);

  return (
    <group
      ref={bind('group')}
      name="weekly-downloads"
      visible={false}
      userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
    >
      <mesh position={[0, 0.24, 0]} renderOrder={-1}>
        <planeGeometry args={[width, 0.48]} />
        <meshBasicNodeMaterial
          ref={bind('backdrop')}
          color="#000000"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <TextGroup renderOrder={2}>
        <Text
          ref={bind('number')}
          name="download-count"
          font={font}
          position={[-width / 2, 0.4, 0.01]}
          constraints={{ width: { mode: 'exact', size: width } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.32, lineHeight: 1, color: '#ffffff', opacity: 0 }}
        >
          {downloadsLabel(0)}
        </Text>
      </TextGroup>
    </group>
  );
}
