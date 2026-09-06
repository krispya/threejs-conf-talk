import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useMemo } from 'react';
import { color, hash, mix, positionLocal, smoothstep, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { charter } from '../../data/charter.js';
import { fonts } from '../../theme.js';

/** Ink wear follows the printed surface as the paper moves and folds. */
function stampNoise(point: Node<'vec2'>) {
  const cell = point.floor();
  const fraction = point.fract();
  const blend = fraction.mul(fraction).mul(vec2(3).sub(fraction.mul(2)));
  const seed = cell.x.add(cell.y.mul(4096));
  const sample = (offset: number) => hash(seed.add(offset).toInt());
  return mix(mix(sample(0), sample(1), blend.x), mix(sample(4096), sample(4097), blend.x), blend.y);
}

export function CharterDateStamp({ opacity }: { opacity: Node<'float'> }) {
  const sans = useMSDF(fonts.sans);
  const materials = useMemo(
    () =>
      [0.9, 0.34].map((strength, layer) =>
        defineTextMaterial((context) => {
          const material = context.createDefaultMaterial();
          const point = positionLocal.xy.add(vec2(17.1, 29.4).mul(layer));
          const pressure = stampNoise(point.mul(vec2(0.9, 3)))
            .mul(0.2)
            .add(0.8);
          const patches = smoothstep(0.12, 0.34, stampNoise(point.mul(vec2(6.5, 10)).add(13.7)));
          const pores = smoothstep(0.12, 0.3, stampNoise(point.mul(32).add(47.3)))
            .mul(0.75)
            .add(0.25);
          const coverage = pressure.mul(patches).mul(pores);
          const ink = (layer === 1 ? coverage.mul(0.5).add(0.5) : coverage)
            .mul(opacity)
            .mul(strength);
          material.colorNode = color('#bc1921');
          material.opacityNode = (material.opacityNode as Node<'float'> | null)?.mul(ink) ?? ink;
          material.depthTest = true;
          material.depthWrite = false;
          return material;
        })
      ),
    [opacity]
  );
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(charter.firstCommittedAt))
    .toUpperCase();

  return (
    <group name="charter-date-stamp" position={[9.4, -0.1, 0.12]} rotation={[0, 0, -0.12]}>
      <TextGroup renderOrder={6}>
        <Text
          font={sans}
          material={materials[1]}
          position={[-6.475, 0.76, 0.01]}
          constraints={{ width: { mode: 'exact', size: 13 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 1.55, lineHeight: 1 }}
        >
          {date}
        </Text>
        <Text
          font={sans}
          material={materials[0]}
          position={[-6.5, 0.78, 0.02]}
          constraints={{ width: { mode: 'exact', size: 13 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 1.55, lineHeight: 1 }}
        >
          {date}
        </Text>
      </TextGroup>
    </group>
  );
}
