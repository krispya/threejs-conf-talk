import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import type { Entity } from 'koota';
import { useQuery, useTrait } from 'koota/react';
import type { Group } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { fonts, theme } from '../../theme.js';

const { Letter, Position, Ref } = traits;

useMSDF.preload(fonts.sans);

/** Glyph box size in world units. Each letter is laid out in a square cell of this size. */
const SIZE = 1.6;

export function LetterRenderer() {
  const letters = useQuery(Letter, Position);

  return (
    // One TextGroup so every letter batches into as few draws as the planner can manage.
    // Drawn before the package blobs so they float over the word.
    <TextGroup name="pmndrs" renderOrder={-2}>
      {letters.map((entity) => (
        <LetterView key={entity} entity={entity} />
      ))}
    </TextGroup>
  );
}

function LetterView({ entity }: { entity: Entity }) {
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
        position={[-SIZE / 2, SIZE / 2, 0]}
        style={{ color: theme.foreground, fontSize: SIZE, lineHeight: 1 }}
      >
        {char}
      </Text>
    </group>
  );
}
