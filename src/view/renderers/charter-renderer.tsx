import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useThree } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useQuery, useQueryFirst, useTarget, useTrait } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { color, normalView, smoothstep, uv } from 'three/tsl';
import type { Group, Node } from 'three/webgpu';
import { charter } from '../../data/charter.js';
import { ActiveScreen, Charter, Hidden, Position, Ref, Screen, Timeline } from '../../sim/index.js';
import { brand, fonts, ramp } from '../../theme.js';
import { useEntityVisible } from '../use-entity-visible.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { CharterDateStamp } from './charter-date-stamp.js';
import { CharterMarker } from './charter-marker.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);

export function CharterRenderer() {
  const documents = useQuery(Charter, Position);
  return documents.map((entity) => <CharterView key={entity} entity={entity} />);
}

function CharterView({ entity }: { entity: Entity }) {
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const visible = useEntityVisible(entity);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const focus = useTransitionOpacity(useTrait(screen, Screen)?.charterFocus ?? false, {
    duration: 2.2,
    ease: easing.cubicInOut,
  });
  const progress = useTransitionOpacity(visible, { duration: visible ? undefined : 1 });
  const departure = useTransitionOpacity(useTrait(screen, Screen)?.announcementVisible ?? false, {
    duration: 1,
    ease: easing.cubicInOut,
  });
  const sheet = useRef<Group>(null);
  const upperFold = useRef<Group>(null);
  const lowerFold = useRef<Group>(null);
  const canvas = useThree((state) => state.renderer.domElement);
  const previousCursor = useRef<string | null>(null);
  const resetCursor = useCallback(() => {
    if (previousCursor.current === null) return;
    canvas.style.setProperty('cursor', previousCursor.current);
    previousCursor.current = null;
  }, [canvas]);
  useEffect(() => resetCursor, [resetCursor, visible]);
  const opacity = useMemo(() => smoothstep(0, 0.08, progress), [progress]);
  const material = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color(brand.dark);
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(opacity) ?? opacity;
        material.depthWrite = false;
        material.depthTest = true;
        return material;
      }),
    [opacity]
  );
  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      const position = entity.get(Position)!;
      group.position.set(position.x, position.y, position.z);
      entity.add(Ref(group));
      return () => {
        if (entity.isAlive()) entity.remove(Ref);
      };
    },
    [entity]
  );

  useFrame(
    (state) => {
      const group = entity.get(Ref);
      if (!group) return;
      group.visible = progress.value > 0;
      if (!group.visible || !sheet.current || !upperFold.current || !lowerFold.current) return;

      const reveal = focus.value > 0 ? 1 : progress.value;
      const slide = easing.cubicOut(clamp(reveal / 0.5, 0, 1));
      const { height } = state.viewport.getCurrentViewport(state.camera, group.position);
      // Slide the sheet until the initiatives heading at local y -5.1 reaches the top edge.
      sheet.current.position.set(
        lerp(3, 0, slide),
        lerp(60, 0, slide) +
          ((state.camera.position.y + height / 2 - 0.2 - group.position.y) / group.scale.y + 5.1) *
            focus.value +
          departure.value * 35,
        0
      );
      sheet.current.rotation.set(lerp(-0.12, 0, slide), lerp(-0.08, 0, slide), lerp(0.05, 0, slide));
      lowerFold.current.rotation.x = lerp(
        -2.97,
        -0.018,
        easing.cubicInOut(clamp((reveal - 0.2) / 0.65, 0, 1))
      );
      upperFold.current.rotation.x = lerp(
        3.06,
        0.025,
        easing.cubicInOut(clamp((reveal - 0.45) / 0.55, 0, 1))
      );
    },
    { priority: -0.6 }
  );

  return (
    <group ref={handleInit} name="charter" scale={0.13} visible={false}>
      <group ref={sheet} name="charter-sheet">
        <PaperPanel opacity={opacity}>
          <CharterDateStamp opacity={opacity} />
          <TextGroup material={material} renderOrder={6}>
            {charter.sections.slice(1, 5).map((heading, index) => (
              <Text
                key={heading}
                font={sans}
                position={[-17.8, 4.5 - index * 2.4, 0.1]}
                style={{ fontSize: 1.2, lineHeight: 1 }}
              >
                {heading}
              </Text>
            ))}
          </TextGroup>
          <group position={[0, 5, 0.06]}>
            <Crease opacity={opacity} />
          </group>
          <group position={[0, -5, 0.06]} rotation={[0, 0, Math.PI]}>
            <Crease opacity={opacity} />
          </group>
        </PaperPanel>
        <group ref={upperFold} name="charter-upper-fold" position={[0, 5, 0.04]}>
          <group position={[0, 5, 0]}>
            <PaperPanel opacity={opacity}>
              <mesh position={[0, -1.3, 0.05]} renderOrder={5}>
                <planeGeometry args={[35.6, 0.035]} />
                <meshBasicNodeMaterial
                  color={brand.dark}
                  opacityNode={opacity.mul(0.18)}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <TextGroup material={material} renderOrder={6}>
                <Text font={mono} position={[-17.8, 3.2, 0.1]} style={{ fontSize: 0.48 }}>
                  PMNDRS / ORG
                </Text>
                <Text font={mono} position={[16.3, 3.2, 0.1]} style={{ fontSize: 0.48 }}>
                  {charter.status}
                </Text>
                <Text
                  font={sans}
                  position={[-17.8, 1.7, 0.1]}
                  style={{ fontSize: 1.9, lineHeight: 1 }}
                >
                  {charter.title}
                </Text>
                <Text
                  font={sans}
                  position={[-17.8, -3.1, 0.1]}
                  style={{ fontSize: 1.2, lineHeight: 1 }}
                >
                  {charter.sections[0]}
                </Text>
              </TextGroup>
            </PaperPanel>
          </group>
        </group>
        <group ref={lowerFold} name="charter-lower-fold" position={[0, -5, 0.08]}>
          <group position={[0, -5, 0]}>
            <PaperPanel opacity={opacity}>
              <CharterMarker opacity={opacity} />
              <TextGroup material={material} renderOrder={6}>
                <Text
                  font={sans}
                  position={[-17.8, 4.9, 0.1]}
                  style={{ fontSize: 1.2, lineHeight: 1 }}
                >
                  {charter.sections[5]}
                </Text>
                {charter.sections.slice(6).map((heading, index) => (
                  <Text
                    key={heading}
                    font={sans}
                    position={[-17.8, 2.5 - index * 2.4, 0.1]}
                    style={{ fontSize: 1.2, lineHeight: 1 }}
                  >
                    {heading}
                  </Text>
                ))}
                <Text
                  font={mono}
                  position={[-17.8, -1.9, 0.1]}
                  style={{ fontSize: 0.65, lineHeight: 1 }}
                >
                  {charter.source.replace('https://', '')}
                </Text>
              </TextGroup>
              <mesh position={[-13.7, -2.7, 0.1]} renderOrder={5}>
                <planeGeometry args={[8.2, 0.035]} />
                <meshBasicNodeMaterial
                  color={brand.dark}
                  opacityNode={opacity}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh
                name="charter-link"
                position={[-13.7, -2.2, 0.2]}
                onClick={(event) => {
                  if (entity.has(Hidden) || progress.value < 0.99) return;
                  event.stopPropagation();
                  window.open(charter.source, '_blank', 'noopener,noreferrer');
                }}
                onPointerOver={() => {
                  if (entity.has(Hidden) || progress.value < 0.99) return;
                  previousCursor.current ??= canvas.style.cursor;
                  canvas.style.setProperty('cursor', 'pointer');
                }}
                onPointerOut={resetCursor}
              >
                <planeGeometry args={[9.2, 1.8]} />
                <meshBasicNodeMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </PaperPanel>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Thin solid panels let the folds cover the printed faces as the sheet closes. */
function PaperPanel({ children, opacity }: { children: ReactNode; opacity: Node<'float'> }) {
  const paper = useMemo(
    () => color(ramp['light-25']).mul(normalView.z.abs().mul(0.18).add(0.82)),
    []
  );
  return (
    <>
      <mesh renderOrder={4}>
        <boxGeometry args={[40, 10, 0.04]} />
        <meshBasicNodeMaterial
          colorNode={paper}
          opacityNode={opacity}
          transparent
          depthWrite
          toneMapped={false}
        />
      </mesh>
      {children}
    </>
  );
}

/** A soft trough and a fine highlight leave a crease after the fold opens. */
function Crease({ opacity }: { opacity: Node<'float'> }) {
  const shadow = useMemo(() => uv().y.oneMinus().mul(-6).exp().mul(0.18).mul(opacity), [opacity]);
  return (
    <>
      <mesh position={[0, -0.35, 0]} renderOrder={5}>
        <planeGeometry args={[40, 0.7]} />
        <meshBasicNodeMaterial
          color={brand.dark}
          opacityNode={shadow}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={5}>
        <planeGeometry args={[40, 0.035]} />
        <meshBasicNodeMaterial
          color={brand.dark}
          opacityNode={opacity.mul(0.14)}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.045, 0]} renderOrder={5}>
        <planeGeometry args={[40, 0.035]} />
        <meshBasicNodeMaterial
          color="#ffffff"
          opacityNode={opacity.mul(0.7)}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
