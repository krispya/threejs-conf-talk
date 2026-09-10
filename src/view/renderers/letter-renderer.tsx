import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { Text as GlyphText } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useQuery, useQueryFirst, useTarget, useTrait } from 'koota/react';
import { type ComponentRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Group, Mesh } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { createGradientTextMaterial } from '../gradient-text-material.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';

const { ActiveScreen, Letter, Position, Ref, Screen, Timeline } = traits;

useMSDF.preload(fonts.sans);

/** Glyph box size in world units. Each letter is laid out in a square cell of this size. */
const SIZE = 2;

export function LetterRenderer() {
  const letters = useQuery(Letter, Position);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.lettersVisible ?? false;
  const timing = useTrait(timeline, Timeline);
  const [group, setGroup] = useState<ComponentRef<typeof TextGroup> | null>(null);
  const [prepared, setPrepared] = useState<typeof group>(null);
  const [painted, setPainted] = useState<typeof group>(null);
  const probe = useRef<{ group: NonNullable<typeof group>; meshes: Mesh[]; drawn: Set<Mesh> } | null>(
    null
  );
  const [error, setError] = useState<unknown>(null);
  const pending = useRef<typeof group>(null);
  const opacity = useTransitionOpacity(visible, {
    ready: group !== null && painted === group,
    clock: 'frames',
    duration: timing?.duration ?? 2.1,
  });
  const material = useMemo(
    () => createGradientTextMaterial({ contrast: 0.24, saturation: 1.6, opacity }),
    [opacity]
  );

  useLayoutEffect(() => {
    if (!group || prepared !== group || painted === group) return;
    const meshes: Mesh[] = [];
    const drawn = new Set<Mesh>();
    const restore: (() => void)[] = [];
    group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      meshes.push(child);
      // Keep the original method so its receiver and identity can be restored.
      // oxlint-disable-next-line typescript/unbound-method
      const { onAfterRender, frustumCulled } = child;
      child.frustumCulled = false;
      child.onAfterRender = function (...args) {
        onAfterRender.apply(this, args);
        drawn.add(child);
      };
      restore.push(() => {
        child.onAfterRender = onAfterRender;
        child.frustumCulled = frustumCulled;
      });
    });
    probe.current = { group, meshes, drawn };
    return () => {
      for (const undo of restore) undo();
      probe.current = null;
    };
  }, [group, prepared, painted]);

  useFrame(
    () => {
      const pending = probe.current;
      if (!pending || pending.meshes.length === 0 || pending.drawn.size !== pending.meshes.length)
        return;
      // Release the fade only after the complete batch has been submitted at zero opacity.
      setPainted(pending.group);
      probe.current = null;
    },
    { phase: 'finish' }
  );

  useFrame(
    ({ renderer, camera, scene }) => {
      if (!group) return;
      // Three owns the mounted object's mutable visibility.
      // oxlint-disable-next-line react/immutability
      group.visible = opacity.value > 0 || (prepared === group && painted !== group);
      if (prepared === group || pending.current === group || !renderer.hasInitialized()) return;

      let committed = 0;
      group.traverse((child) => {
        if (child instanceof GlyphText && child.commitState().status === 'committed') committed++;
      });
      if (letters.length === 0 || committed !== letters.length) return;

      // Text layout and GPU compilation must finish before the first fade starts.
      pending.current = group;
      void warmUp(renderer, group, camera, scene)?.then(
        () => {
          if (!group.disposed) setPrepared(group);
        },
        (error: unknown) => {
          if (!group.disposed) setError(error);
        }
      );
    },
    { priority: -0.6 }
  );

  if (error) throw error;

  return (
    // One TextGroup so every letter batches into as few draws as the planner can manage.
    // Drawn before the package blobs so they float over the word.
    <TextGroup ref={setGroup} name="pmndrs" renderOrder={-2}>
      {letters.map((entity) => (
        <LetterView key={entity} entity={entity} material={material} />
      ))}
    </TextGroup>
  );
}

function LetterView({
  entity,
  material,
}: {
  entity: Entity;
  material: ReturnType<typeof createGradientTextMaterial>;
}) {
  const font = useMSDF(fonts.sans);
  const { char } = useTrait(entity, Letter)!;

  const handleInit = (group: Group | null) => {
    if (!group) return;
    entity.add(Ref(group));
    return () => entity.remove(Ref);
  };

  return (
    <group ref={handleInit}>
      {/* Paragraph origin is the box's top-left corner, so offset by half a cell to center it */}
      <Text
        font={font}
        constraints={{ width: { mode: 'exact', size: SIZE } }}
        layout={{ align: 'center', wrap: 'none' }}
        material={material}
        position={[-SIZE / 2, SIZE / 2, 0]}
        style={{ fontSize: SIZE, lineHeight: 1 }}
      >
        {char}
      </Text>
    </group>
  );
}
