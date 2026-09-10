import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { type ComponentRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Group, MeshBasicNodeMaterial } from 'three/webgpu';
import { ActiveScreen, Package, Ref, Screen, Time, Timeline } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';

/** Count the same download snapshot that determines the sphere's area. */
export function PackageDownloads({
  entity,
  timeline,
  radius,
  visible,
  showRate,
  exitDuration,
}: {
  entity: Entity;
  timeline: Entity | undefined;
  radius: number;
  visible: boolean;
  showRate: boolean;
  exitDuration: number | undefined;
}) {
  const world = useWorld();
  const timing = useTrait(timeline, Timeline);
  const { downloads } = useTrait(entity, Package)!;
  const [present, setPresent] = useState(visible);
  // The rate stays fixed for as long as a ticker is on screen so its chip never resizes.
  const [rate, setRate] = useState(showRate);
  const font = useMSDF(fonts.mono);
  const formatter = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const suffix = rate ? ' dl/wk' : '';
  const width = (formatter.format(downloads).length + suffix.length) * 0.32 * 0.62 + 0.24;
  const groupRef = useRef<Group>(null);
  const numberRef = useRef<ComponentRef<typeof Text>>(null);
  const backdropRef = useRef<MeshBasicNodeMaterial>(null);
  const animation = useRef({
    startedAt: 0,
    countStartedAt: 0,
    countDuration: 0,
    counting: false,
    stagger: 0,
    fromOpacity: 0,
    opacity: 0,
    fromY: -0.42,
    y: -0.42,
    fromScale: 0.92,
    scale: 0.92,
    anchorX: 0,
    anchorY: 0,
    anchorZ: 0,
    fromAnchorX: 0,
    fromAnchorY: 0,
    fromAnchorZ: 0,
    rejoining: false,
    countFrom: 0,
    tick: -1,
    value: -1,
  });

  if (visible && !present) setPresent(true);
  if (visible && rate !== showRate) setRate(showRate);

  useLayoutEffect(() => {
    const now = world.get(Time)!.elapsed;
    const screen = timeline?.targetFor(ActiveScreen)?.get(Screen);
    const state = animation.current;
    const fresh = visible && state.opacity === 0;
    if (fresh) {
      const names = screen?.packageNames ?? [];
      state.stagger =
        Math.max(0, names.indexOf(entity.get(Package)!.name)) * (screen?.packageStagger ?? 0);
      state.y = -0.42;
      state.scale = 0.92;
      state.value = 0;
      numberRef.current?.set({ text: `0${suffix}` });
      if (groupRef.current) groupRef.current.visible = false;
    }
    state.fromOpacity = state.opacity;
    state.fromY = state.y;
    state.fromScale = state.scale;
    state.fromAnchorX = state.anchorX;
    state.fromAnchorY = state.anchorY;
    state.fromAnchorZ = state.anchorZ;
    state.rejoining = visible && !fresh;
    state.startedAt = fresh
      ? (timing?.startedAt ?? now) +
        (screen?.packageDelay ?? 0) +
        Math.min(0.24, (timing?.duration ?? 0) * 0.25) +
        state.stagger
      : exitDuration !== undefined
        ? (timing?.startedAt ?? now)
        : now + (visible ? 0 : state.stagger * 0.5);
    // Advancing to the robot keeps the same counter running from its original start
    if (visible && !state.counting) {
      state.countStartedAt = state.startedAt;
      state.countDuration = screen?.packageLayout === 'community' ? 3.2 : 0;
      state.countFrom = Math.max(0, state.value);
      state.tick = -1;
    }
    state.counting = visible;
  }, [visible, timing, world, entity, timeline, exitDuration, suffix]);

  useFrame(
    () => {
      const group = groupRef.current;
      const number = numberRef.current;
      const backdrop = backdropRef.current;
      const body = entity.get(Ref);
      if (!group || !number || !backdrop || !body) return;

      const state = animation.current;
      const elapsed = world.get(Time)!.elapsed - state.startedAt;
      const duration = visible ? 0.6 : Math.min(exitDuration ?? 0.34, 0.45);
      const progress = duration <= 0 ? 1 : clamp(elapsed / duration, 0, 1);
      if (visible) {
        const settle = Math.sin(progress * Math.PI) ** 2;
        state.y = lerp(state.fromY, 0, easing.cubicOut(progress)) + settle * 0.08;
        state.scale = lerp(state.fromScale, 1, easing.cubicOut(progress)) + settle * 0.018;
        const size = radius * body.scale.x;
        const rejoin = state.rejoining ? easing.cubicOut(progress) : 1;
        state.anchorX = lerp(state.fromAnchorX, body.position.x, rejoin);
        state.anchorY = lerp(state.fromAnchorY, body.position.y + size + 0.25, rejoin);
        state.anchorZ = lerp(state.fromAnchorZ, body.position.z + size + 0.04, rejoin);
      } else {
        state.y = state.fromY + easing.cubicIn(progress) * (exitDuration === undefined ? 0.65 : -0.5);
        state.scale = lerp(state.fromScale, 0.82, easing.cubicIn(progress));
      }
      const opacity = visible
        ? lerp(state.fromOpacity, 1, easing.cubicOut(clamp(elapsed / 0.22, 0, 1)))
        : lerp(state.fromOpacity, 0, easing.cubicIn(progress));
      group.visible = opacity > 0;
      if (!visible && opacity === 0) setPresent(false);
      if (opacity !== state.opacity) {
        number.set({ style: { ...number.style, opacity } });
        backdrop.opacity = opacity;
        state.opacity = opacity;
      }
      if (!group.visible) return;

      // Keep the ticker anchored while its exit follows the package group.
      group.scale.setScalar(state.scale);
      group.position.set(state.anchorX, state.anchorY + state.y, state.anchorZ);

      // Update the retained glyphs at 30 Hz while the counter runs, then leave them alone.
      const countElapsed = Math.max(0, world.get(Time)!.elapsed - state.countStartedAt);
      const tick = Math.floor(countElapsed * 30);
      if (visible && tick !== state.tick && state.value !== downloads) {
        const value = Math.round(
          lerp(
            state.countFrom,
            downloads,
            state.countDuration > 0
              ? easing.cubicOut(clamp(countElapsed / state.countDuration, 0, 1))
              : 1 - Math.exp(-countElapsed / 1.2)
          )
        );
        if (value !== state.value) number.set({ text: `${formatter.format(value)}${suffix}` });
        state.tick = tick;
        state.value = value;
      }
    },
    { priority: -0.55, enabled: present }
  );

  return (
    <group
      ref={groupRef}
      name="weekly-downloads"
      visible={false}
      renderOrder={2}
      userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
    >
      <mesh position={[0, 0.24, 0]} renderOrder={-1}>
        <planeGeometry args={[width, 0.48]} />
        <meshBasicNodeMaterial
          ref={backdropRef}
          color="#000000"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <TextGroup>
        <Text
          ref={numberRef}
          name="download-count"
          font={font}
          position={[-width / 2, 0.4, 0.01]}
          constraints={{ width: { mode: 'exact', size: width } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 0.32, lineHeight: 1, color: '#ffffff', opacity: 0 }}
        >
          {`0${suffix}`}
        </Text>
      </TextGroup>
    </group>
  );
}
