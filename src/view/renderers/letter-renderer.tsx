import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { float, luminance, mix, smoothstep, vec3 } from 'three/tsl';
import type { Entity } from 'koota';
import { useQuery, useTrait } from 'koota/react';
import type { Group } from 'three/webgpu';
import { traits } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { gradientNode } from '../background.js';

const { Letter, Position, Ref } = traits;

useMSDF.preload(fonts.sans);

/** Glyph box size in world units. Each letter is laid out in a square cell of this size. */
const SIZE = 2.8;

/** Fixed luminance gap between a letter and whatever is behind it (linear light). */
const CONTRAST = 0.24;
/** Below this luminance the backdrop is dark enough that letters go lighter instead. */
const FLIP_LOW = 0.26;
const FLIP_HIGH = 0.38;

/**
 * Letters are cut from the same gradient as the backdrop, slightly more saturated, and held a
 * fixed luminance distance from it: darker over the pale areas, lighter inside the dusky band.
 * Legibility stays constant while the color still belongs to the field behind it.
 * The default material keeps the MSDF coverage in its opacity.
 */
const gradientTextMaterial = defineTextMaterial((context) => {
  const material = context.createDefaultMaterial();
  const field = gradientNode();
  const lum = luminance(field);
  const saturated = mix(vec3(lum), field, 1.6);

  const darker = saturated.mul(lum.sub(CONTRAST).max(0.02).div(lum.max(0.001)));
  const lighter = mix(saturated, vec3(1), float(CONTRAST).div(float(1).sub(lum).max(0.05)).clamp());
  const towardDark = smoothstep(FLIP_LOW, FLIP_HIGH, lum);

  material.colorNode = mix(lighter, darker, towardDark);
  return material;
});

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
        material={gradientTextMaterial}
        position={[-SIZE / 2, SIZE / 2, 0]}
        style={{ fontSize: SIZE, lineHeight: 1 }}
      >
        {char}
      </Text>
    </group>
  );
}
