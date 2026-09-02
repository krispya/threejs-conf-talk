import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import type { Entity } from 'koota';
import { useQuery, useTrait } from 'koota/react';
import type { Group } from 'three/webgpu';
import { float, smoothstep, uv } from 'three/tsl';
import { traits } from '../../sim/index.js';
import { fonts, ramp, spectrum } from '../../theme.js';

const { Package, Ref, Size } = traits;

useMSDF.preload(fonts.mono);

/** Rough advance of one Geist Mono glyph relative to its font size. */
const MONO_ADVANCE = 0.62;

export function PackageRenderer() {
  const packages = useQuery(Package, Size);

  return (
    <TextGroup name="packages">
      {packages.map((entity) => (
        <PackageView key={entity} entity={entity} />
      ))}
    </TextGroup>
  );
}

function PackageView({ entity }: { entity: Entity }) {
  const font = useMSDF(fonts.mono);
  const { name, index } = useTrait(entity, Package)!;
  const { radius } = useTrait(entity, Size)!;

  const color = spectrum[index % spectrum.length];

  // Fit the label inside the disc, but never below a readable floor
  const fontSize = Math.max(
    0.09,
    Math.min(radius * 0.28, (radius * 1.9) / (name.length * MONO_ADVANCE))
  );
  const width = Math.max(radius * 2, name.length * fontSize * MONO_ADVANCE);

  const handleInit = (group: Group | null) => {
    if (!group) return;
    entity.add(Ref(group));
    return () => entity.remove(Ref);
  };

  return (
    <group ref={handleInit}>
      {/* Drawn before the batched text and writes depth, so the disc hides the letters behind
          it while its own label sits just in front. The alpha test keeps the faded rim from
          punching an invisible hole through the letters. */}
      <mesh renderOrder={-1}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicNodeMaterial alphaTest={0.02} color={color} opacityNode={blobNode()} transparent />
      </mesh>
      <Text
        font={font}
        constraints={{ width: { mode: 'exact', size: width } }}
        layout={{ align: 'center', wrap: 'none' }}
        position={[-width / 2, fontSize / 2, 0.02]}
        style={{ color: ramp['dark-900'], fontSize, lineHeight: 1 }}
      >
        {name}
      </Text>
    </group>
  );
}

/** Soft-edged disc: fully opaque in the middle, fading out toward the rim. */
function blobNode() {
  const distance = uv().sub(0.5).length();
  return float(1).sub(smoothstep(0.4, 0.5, distance));
}
