import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { type ComponentRef, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Color } from 'three/webgpu';
import { color } from 'three/tsl';
import type { BufferGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { packageLabelSize } from '../../package-label.js';
import { brand, fonts, spectrum, theme } from '../../theme.js';
import { GlassMaterial } from '../glass/glass-material.js';
import type { GlassPhysicalNodeMaterial } from '../glass/glass-material-core.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { packageSpring } from '../package-spring.js';
import { PackageDownloads } from './package-downloads.js';
import { PackageFeatures } from './package-features.js';

const { ActiveScreen, Hidden, Package, PackageSizing, Ref, Screen, Size, Time, Timeline } = traits;

useMSDF.preload(fonts.mono);

const labelMaterial = defineTextMaterial((context) => {
  const material = context.createDefaultMaterial();
  material.colorNode = color('#000000');
  return material;
});

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
  const world = useWorld();
  const packages = useQuery(Package, Size);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const timing = useTrait(timeline, Timeline);
  const group = useRef<Group>(null);
  const departure = useRef({ value: 0, from: 0, target: 0, delay: 0, duration: 0, visible: false });
  const leavingDown = !!data?.codeComparisonVisible || !!data?.warpVisible;
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

  useFrame(
    (state) => {
      if (!group.current) return;
      const motion = departure.current;
      const elapsed = world.get(Time)!.elapsed - (timing?.startedAt ?? 0) - motion.delay;
      const progress = motion.duration <= 0 ? 1 : clamp(elapsed / motion.duration, 0, 1);
      motion.value = lerp(
        motion.from,
        motion.target,
        motion.target === 1 ? easing.cubicIn(progress) : easing.cubicOut(progress)
      );
      const { height } = state.viewport.getCurrentViewport(state.camera, [0, 0, 0]);
      group.current.position.y = -height * 1.5 * motion.value;
    },
    { priority: -0.5 }
  );

  return (
    <group ref={group} name="packages" renderOrder={1}>
      <TextGroup>
        {packages.map((entity) => (
          <PackageView
            key={entity}
            entity={entity}
            timeline={timeline}
            solid={data?.background === 'solid'}
            showDownloads={data?.packageDownloadsVisible ?? false}
            showFeatures={data?.packageFeaturesVisible ?? false}
            exitDuration={exitDuration}
          />
        ))}
      </TextGroup>
    </group>
  );
}

function PackageView({
  entity,
  timeline,
  solid,
  showDownloads,
  showFeatures,
  exitDuration,
}: {
  entity: Entity;
  timeline: Entity | undefined;
  solid: boolean;
  showDownloads: boolean;
  showFeatures: boolean;
  exitDuration: number | undefined;
}) {
  const world = useWorld();
  const timing = useTrait(timeline, Timeline);
  const font = useMSDF(fonts.mono);
  const { name, label: displayLabel, index } = useTrait(entity, Package)!;
  const nameLabel = displayLabel || name;
  const { compressed: radius } = useTrait(entity, PackageSizing)!;
  const visible = !useHas(entity, Hidden);
  const [present, setPresent] = useState(visible);
  const progress = useRef(visible ? 1 : 0);
  const transition = useRef({
    from: visible ? 1 : 0,
    target: visible ? 1 : 0,
    startedAt: 0,
    delay: 0,
    duration: 0,
    spring: false,
  });
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh<BufferGeometry, GlassPhysicalNodeMaterial>>(null);
  const labelRef = useRef<ComponentRef<typeof Text>>(null);
  const labelGroup = useRef<Group>(null);
  const chipMaterial = useRef<MeshBasicNodeMaterial>(null);

  const { fontSize, width } = packageLabelSize(radius, nameLabel);

  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      groupRef.current = group;
      group.scale.setScalar(Math.max(0.001, (progress.current * entity.get(Size)!.radius) / radius));
      entity.add(Ref(group));
      return () => {
        groupRef.current = null;
        entity.remove(Ref);
      };
    },
    [entity, radius]
  );

  if (visible && !present) setPresent(true);

  useLayoutEffect(() => {
    const screen = timeline?.targetFor(ActiveScreen)?.get(Screen);
    const names = screen?.packageNames ?? [];
    const count = names.length || world.query(Package).length;
    const duration = timing?.duration ?? 0;
    const entering = visible && progress.current === 0;
    const returning = visible && screen?.packageEntry === 'rise';
    const delay = entering ? (screen?.packageDelay ?? 0) : 0;
    const stagger = entering
      ? Math.min(screen?.packageStagger ?? 0, duration / Math.max(1, count))
      : 0;
    transition.current = {
      from: returning ? 1 : progress.current,
      target: visible ? 1 : 0,
      startedAt: timing?.startedAt ?? world.get(Time)!.elapsed,
      delay: delay + (names.length ? Math.max(0, names.indexOf(name)) : index) * stagger,
      // The final package settles before the shared screen transition finishes.
      duration: returning
        ? 0
        : (exitDuration ??
          (screen?.packageDuration || duration - delay - Math.max(0, count - 1) * stagger)),
      spring: visible && screen?.packageLayout === 'pair',
    };
  }, [visible, timing, timeline, world, name, index, exitDuration]);

  // Keep the glass active until its exit finishes, and reverse from the current progress
  useFrame(
    () => {
      const group = groupRef.current;
      const mesh = meshRef.current;
      const label = labelRef.current;
      const { from, target, startedAt, delay, duration, spring } = transition.current;
      if (!group || !mesh || !label || !labelGroup.current || !chipMaterial.current) return;

      const previousOpacity = clamp(progress.current, 0, 1);
      const elapsed = world.get(Time)!.elapsed - startedAt - delay;
      const time = duration <= 0 ? 1 : clamp(elapsed / duration, 0, 1);
      const alpha = spring ? packageSpring(time) : easing.cubicOut(time);
      progress.current = exitDuration !== undefined && time < 1 ? from : lerp(from, target, alpha);

      const currentRadius = entity.get(Size)!.radius;
      group.scale.setScalar(Math.max(0.001, (progress.current * currentRadius) / radius));
      // Keep labels in a readable size range while the spheres grow and shrink
      labelGroup.current.scale.setScalar(
        (packageLabelSize(currentRadius, nameLabel).fontSize * radius) / (fontSize * currentRadius)
      );
      const opacity = clamp(progress.current, 0, 1);
      mesh.material.opacity = opacity;
      chipMaterial.current.opacity = opacity;
      if (opacity !== previousOpacity) {
        label.set({ style: { fontSize, lineHeight: 1, opacity } });
      }

      if (progress.current === 0 && target === 0) {
        group.visible = false;
        setPresent(false);
      }
    },
    { priority: -0.5, enabled: present }
  );

  return (
    <>
      <group ref={handleInit} visible={present} name={name} renderOrder={1}>
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
            background={solid ? brand.green : theme.background}
          />
        </mesh>
        <group
          ref={labelGroup}
          name="package-label"
          renderOrder={1}
          position={[0, 0, radius + 0.04]}
          userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
        >
          <mesh renderOrder={-1}>
            <planeGeometry args={[width, fontSize * 1.5]} />
            <meshBasicNodeMaterial
              ref={chipMaterial}
              color={brand.purple}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <Text
            ref={labelRef}
            font={font}
            constraints={{ width: { mode: 'exact', size: width } }}
            layout={{ align: 'center', wrap: 'none' }}
            material={labelMaterial}
            position={[-width / 2, fontSize / 2, 0.01]}
            style={{ fontSize, lineHeight: 1 }}
          >
            {nameLabel}
          </Text>
        </group>
      </group>
      <PackageDownloads
        entity={entity}
        timeline={timeline}
        radius={radius}
        visible={showDownloads && visible}
        exitDuration={exitDuration}
      />
      {name === 'three' && (
        <PackageFeatures entity={entity} timeline={timeline} visible={showFeatures && visible} />
      )}
    </>
  );
}
