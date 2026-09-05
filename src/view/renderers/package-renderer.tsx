import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useTrait } from 'koota/react';
import { lerp } from 'math';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import { Color } from 'three/webgpu';
import type { BufferGeometry, Group, Mesh } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { fonts, spectrum, theme } from '../../theme.js';
import { GlassMaterial } from '../glass/glass-material.js';
import type { GlassPhysicalNodeMaterial } from '../glass/glass-material-core.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { createGradientTextMaterial } from '../gradient-text-material.js';

const { Hidden, Package, Ref, Size } = traits;

useMSDF.preload(fonts.mono);

/** Rough advance of one Geist Mono glyph relative to its font size. */
const MONO_ADVANCE = 0.62;

/**
 * Labels take their color from the gradient showing through the glass, held a modest step
 * darker so they read on the highlights without turning into black stamps.
 */
const labelMaterial = createGradientTextMaterial({ contrast: 0.34, saturation: 1.5 });

/** How far from clear a tinted blob leans toward its brand color. */
const TINT_STRENGTH = 0.14;
const CLEAR = '#ffffff';

/** Every third blob stays perfectly clear; the rest carry a faint brand tint. */
function tintFor(index: number) {
  if (index % 3 === 0) return CLEAR;
  const tint = new Color(CLEAR).lerp(new Color(spectrum[index % spectrum.length]), TINT_STRENGTH);
  return `#${tint.getHexString()}`;
}

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
  const visible = !useHas(entity, Hidden);
  const [present, setPresent] = useState(visible);
  const progress = useRef(visible ? 1 : 0);
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh<BufferGeometry, GlassPhysicalNodeMaterial>>(null);
  const labelRef = useRef<ComponentRef<typeof Text>>(null);

  // Fit the label inside the blob, but never below a readable floor
  const fontSize = Math.max(
    0.09,
    Math.min(radius * 0.28, (radius * 1.9) / (name.length * MONO_ADVANCE))
  );
  const width = Math.max(radius * 2, name.length * fontSize * MONO_ADVANCE);

  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      groupRef.current = group;
      group.scale.setScalar(Math.max(0.001, progress.current));
      entity.add(Ref(group));
      return () => {
        groupRef.current = null;
        entity.remove(Ref);
      };
    },
    [entity]
  );

  if (visible && !present) setPresent(true);

  // Keep the glass active until its exit finishes, and reverse from the current progress
  useFrame(
    (_, delta) => {
      const group = groupRef.current;
      const mesh = meshRef.current;
      const label = labelRef.current;
      const target = visible ? 1 : 0;
      if (!group || !mesh || !label || progress.current === target) return;

      progress.current = lerp(progress.current, target, 1 - Math.exp(-14 * delta));
      if (Math.abs(progress.current - target) < 0.001) progress.current = target;

      group.scale.setScalar(Math.max(0.001, progress.current));
      mesh.material.opacity = progress.current;
      label.set({ style: { fontSize, lineHeight: 1, opacity: progress.current } });

      if (progress.current === 0) {
        group.visible = false;
        setPresent(false);
      }
    },
    { priority: -0.5, enabled: present }
  );

  return (
    <group ref={handleInit} visible={present}>
      {/* Clear glass sphere. Drawn before the batched text so labels sit on the surface. */}
      <mesh ref={meshRef} renderOrder={-1}>
        <sphereGeometry args={[radius, 64, 48]} />
        <GlassMaterial
          enabled={present}
          color={tintFor(index)}
          transmission={1}
          thickness={radius}
          roughness={0}
          ior={2.0}
          dispersion={8}
          anisotropicBlur={0}
          attenuationDistance={0}
          envMapIntensity={0.18}
          samples={4}
          backside
          backsideThickness={radius * 2}
          background={theme.background}
        />
      </mesh>
      {/* Label sits on the glass surface and is kept out of the refraction capture */}
      <Text
        ref={labelRef}
        font={font}
        constraints={{ width: { mode: 'exact', size: width } }}
        layout={{ align: 'center', wrap: 'none' }}
        material={labelMaterial}
        position={[-width / 2, fontSize / 2, radius + 0.02]}
        userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
        style={{ fontSize, lineHeight: 1 }}
      >
        {name}
      </Text>
    </group>
  );
}
