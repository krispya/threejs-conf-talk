import { useActiveScreen } from '../timeline/hooks.js';
import { Position } from '../traits.js';
import { TextGroup, Text } from '@pmndrs/glyph/react';
import { useMsdf } from '@pmndrs/glyph/react/msdf';
import { Text as GlyphText } from '@pmndrs/glyph/three';
import { useFrame } from '@react-three/fiber/webgpu';
import { useQuery, useTrait } from 'koota/react';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { Timeline } from '../timeline/traits.js';
import { Letter } from './traits.js';
import { fonts } from '../theme.js';
import { createGradientTextMaterial } from '../background/utils/text-material.js';
import { useTransitionOpacity } from '../transition/use-transition-opacity.js';
import { useViewBinding } from '../view/hooks.js';
import type { Entity } from 'koota';

void useMsdf.preload(fonts.sans);

export function LetterRenderer() {
  const letters = useQuery(Letter, Position);
  const { timeline, data } = useActiveScreen();
  const visible = data?.lettersVisible ?? false;
  const timing = useTrait(timeline, Timeline);
  const [group, setGroup] = useState<ComponentRef<typeof TextGroup> | null>(null);
  const groupRef = useRef<typeof group>(null);
  const [prepared, setPrepared] = useState<typeof group>(null);
  const [error, setError] = useState<unknown>(null);
  const pending = useRef<typeof group>(null);
  const opacity = useTransitionOpacity(visible, {
    ready: group !== null && prepared === group,
    clock: 'frames',
    duration: timing?.duration ?? 2.1,
  });
  const material = useMemo(
    () => createGradientTextMaterial({ contrast: 0.24, saturation: 1.6, opacity }),
    [opacity]
  );

  useFrame(({ renderer, camera, scene }) => {
    const group = groupRef.current;
    if (!group) return;
    // Three owns the mounted object's mutable visibility.
    group.visible = opacity.value > 0 || prepared !== group;
    if (prepared === group || pending.current === group || !renderer.hasInitialized()) return;

    let committed = 0;
    group.traverse((child) => {
      if (child instanceof GlyphText && child.commitState().status === 'committed') committed += 1;
    });
    if (letters.length === 0 || committed !== letters.length) return;

    // Glyph owns scene-level batches, so compile the scene before releasing the fade.
    pending.current = group;
    void renderer.compileAsync(scene, camera).then(
      () => {
        if (!group.disposed) setPrepared(group);
      },
      (error: unknown) => {
        if (!group.disposed) setError(error);
      }
    );
  });

  if (error) throw error;

  return (
    // One TextGroup so every letter batches into as few draws as the planner can manage.
    // Drawn before the package blobs so they float over the word.
    <TextGroup
      ref={(group) => {
        groupRef.current = group;
        setGroup(group);
      }}
      name="pmndrs"
      renderOrder={-2}
    >
      {letters.map((entity) => (
        <LetterView key={entity} entity={entity} material={material} />
      ))}
    </TextGroup>
  );
}

/** Glyph box size in world units. Each letter is laid out in a square cell of this size. */
const SIZE = 2;

function LetterView({
  entity,
  material,
}: {
  entity: Entity;
  material: ReturnType<typeof createGradientTextMaterial>;
}) {
  const font = useMsdf(fonts.sans);
  const { char } = useTrait(entity, Letter)!;

  const handleInit = useViewBinding(entity);

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
