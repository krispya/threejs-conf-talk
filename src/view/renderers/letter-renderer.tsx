import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useQuery, useQueryFirst, useTarget, useTrait } from 'koota/react';
import { type ComponentRef, useMemo, useRef } from 'react';
import type { Group } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { createGradientTextMaterial } from '../gradient-text-material.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

const { ActiveScreen, Letter, Position, Ref, Screen, Timeline } = traits;

useMSDF.preload(fonts.sans);

/** Glyph box size in world units. Each letter is laid out in a square cell of this size. */
const SIZE = 2;

export function LetterRenderer() {
  const letters = useQuery(Letter, Position);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.lettersVisible ?? false;
  const opacity = useTransitionOpacity(visible);
  const material = useMemo(
    () => createGradientTextMaterial({ contrast: 0.24, saturation: 1.6, opacity }),
    [opacity]
  );
  const groupRef = useRef<ComponentRef<typeof TextGroup>>(null);

  useFrame(
    () => {
      if (groupRef.current) groupRef.current.visible = opacity.value > 0;
    },
    { priority: -0.6 }
  );

  return (
    // One TextGroup so every letter batches into as few draws as the planner can manage.
    // Drawn before the package blobs so they float over the word.
    <TextGroup ref={groupRef} name="pmndrs" renderOrder={-2}>
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
