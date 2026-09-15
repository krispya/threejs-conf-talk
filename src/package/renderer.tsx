import { useActiveScreen } from '../timeline/hooks.js';
import { Size } from '../traits.js';
import { Time } from '../time/traits.js';
import { TextGroup, Text } from '@pmndrs/glyph/react';
import { useFrame } from '@react-three/fiber/webgpu';
import { useQuery, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useLayoutEffect, useRef } from 'react';
import { type Group, type Mesh, type MeshBasicNodeMaterial, Color } from 'three/webgpu';
import { Timeline } from '../timeline/traits.js';
import { Package, PackageParts, PackagePresence, PackageSizing, type GlyphLabel } from './traits.js';
import {
  useViewBinding,
  useEntityVisible,
  useEntityPresent,
  useTraitBinding,
} from '../view/hooks.js';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import type { Entity } from 'koota';
import { packageLabelSize } from './utils/sizing.js';
import { brand, fonts, spectrum } from '../theme.js';
import { GlassMaterial } from '../glass/glass-material.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { PackageDownloads } from './downloads.js';
import { PackageFeatures } from './features.js';
import { PackageMaintainers } from './maintainers.js';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { color } from 'three/tsl';

export function PackageRenderer() {
  const world = useWorld();
  const packages = useQuery(Package, Size);
  const { timeline, data } = useActiveScreen();
  const timing = useTrait(timeline, Timeline);
  const group = useRef<Group>(null);
  const departure = useRef({ value: 0, from: 0, target: 0, delay: 0, duration: 0, visible: false });
  const leavingDown = !!data?.codeComparisonVisible || !!data?.warpVisible || !!data?.teamVisible;
  const exitDuration = leavingDown
    ? Math.min(data?.warpVisible ? 0.65 : 0.9, timing?.duration ?? 0)
    : undefined;

  useLayoutEffect(() => {
    const motion = departure.current;
    const returning = data?.packageEntry === 'rise' && !motion.visible;
    if (data?.packagesVisible && !motion.visible && data.packageEntry === 'scale') motion.value = 0;
    motion.visible = data?.packagesVisible ?? false;
    if (returning && motion.value === 0) motion.value = 1;
    motion.from = motion.value;
    motion.target = leavingDown ? 1 : 0;
    motion.delay = returning ? data.packageDelay : 0;
    motion.duration = returning
      ? data.packageDuration
      : (exitDuration ?? Math.min(0.9, timing?.duration ?? 0));
  }, [
    leavingDown,
    data?.packagesVisible,
    data?.packageEntry,
    data?.packageDelay,
    data?.packageDuration,
    exitDuration,
    timing,
  ]);

  // The whole group slides out of frame together, a local motion for this one object
  useFrame((state) => {
    if (!group.current) return;
    const motion = departure.current;
    const elapsed = world.get(Time)!.elapsed - (timing?.startedAt ?? 0) - motion.delay;
    const progress = motion.duration <= 0 ? 1 : clamp(elapsed / motion.duration, 0, 1);
    motion.value = lerp(
      motion.from,
      motion.target,
      motion.target === 1 ? easing.cubicIn(progress) : easing.cubicOut(progress)
    );
    const { height } = state.viewport.getCurrentViewport(state.camera, [
      0,
      0,
      data?.teamVisible ? -12.5 : 0,
    ]);
    group.current.position.y = -height * 1.5 * motion.value;
  });

  return (
    <group ref={group} name="packages" renderOrder={1}>
      <TextGroup>
        {packages.map((entity) => (
          <PackageView
            key={entity}
            entity={entity}
            showMaintainers={data?.packageMaintainersVisible ?? false}
          />
        ))}
      </TextGroup>
    </group>
  );
}

useMSDF.preload(fonts.mono);

/**
 * The glass sphere and its label. `animatePackages` scales and fades the registered parts
 * from the presence the presentation action captured, and releases the view once it has left.
 */
function PackageView({ entity, showMaintainers }: { entity: Entity; showMaintainers: boolean }) {
  const font = useMSDF(fonts.mono);
  const { name, label: displayLabel, index } = useTrait(entity, Package)!;
  const nameLabel = displayLabel || name;
  const { compressed: radius } = useTrait(entity, PackageSizing)!;
  const visible = useEntityVisible(entity);
  const present = useEntityPresent(entity);
  const { fontSize, width } = packageLabelSize(radius, nameLabel);
  const parts = {
    body: null as Mesh | null,
    label: null as GlyphLabel | null,
    labelGroup: null as Group | null,
    chip: null as MeshBasicNodeMaterial | null,
  };
  const bind = useTraitBinding(entity, PackageParts, parts);

  const bindView = useViewBinding(entity);
  const handleInit = (group: Group | null) => {
    if (!group) return;
    const presence = entity.get(PackagePresence)?.value ?? 0;
    group.scale.setScalar(Math.max(0.001, (presence * entity.get(Size)!.radius) / radius));
    return bindView(group);
  };

  return (
    <>
      <group ref={handleInit} visible={present} name={name} renderOrder={1}>
        {/* Clear glass sphere. Drawn before the batched text so labels sit on the surface. */}
        <mesh ref={bind('body')} renderOrder={-1}>
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
          />
        </mesh>
        <group
          ref={bind('labelGroup')}
          name="package-label"
          renderOrder={1}
          position={[0, 0, radius + 0.04]}
          userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
        >
          <mesh renderOrder={-1}>
            <planeGeometry args={[width, fontSize * 1.5]} />
            <meshBasicNodeMaterial
              ref={bind('chip')}
              color={brand.purple}
              transparent
              opacity={0}
              alphaTest={0.001}
              depthWrite
              toneMapped={false}
            />
          </mesh>
          <Text
            ref={bind('label')}
            font={font}
            constraints={{ width: { mode: 'exact', size: width } }}
            layout={{ align: 'center', wrap: 'none' }}
            material={labelMaterial}
            position={[-width / 2, fontSize / 2, 0.01]}
            style={{ fontSize, lineHeight: 1 }}
          >
            {nameLabel}
          </Text>
          <PackageMaintainers entity={entity} visible={showMaintainers && visible} />
        </group>
      </group>
      <PackageDownloads entity={entity} />
      {name === 'three' && <PackageFeatures entity={entity} />}
    </>
  );
}

const labelMaterial = defineTextMaterial((context) => {
  const material = context.createDefaultMaterial();
  material.colorNode = color('#000000');
  material.depthTest = true;
  return material;
});

/** Every third blob stays perfectly clear. The rest carry a faint brand tint. */
function tintFor(index: number) {
  if (index % 3 === 0) return '#ffffff';
  const tint = new Color('#ffffff').lerp(new Color(spectrum[index % spectrum.length]), 0.14);
  return `#${tint.getHexString()}`;
}
