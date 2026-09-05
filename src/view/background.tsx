import { useThree } from '@react-three/fiber/webgpu';
import { useEffect } from 'react';
import {
  Fn,
  cameraPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  color,
  exp,
  float,
  getViewPosition,
  hash,
  length,
  mix,
  screenSize,
  screenUV,
  time,
  vec2,
  vec4,
} from 'three/tsl';
import { NoToneMapping } from 'three/webgpu';
import { backdrop } from '../theme.js';

// TSL nodes are loosely typed; `any` keeps the shader readable.
/* oxlint-disable typescript/no-explicit-any */
type N = any;

/** Soft gaussian falloff around zero. */
const glow = (distance: N, width: number): N =>
  exp(
    distance
      .mul(distance)
      .negate()
      .div(2 * width * width)
  );

/** Blends the three-band orange, purple, blue arc into `base` around a circle. */
function paintArc(base: N, p: N, center: N, radius: N, strength: N) {
  const arc: N = length(p.sub(center)).sub(radius);
  base.assign(
    mix(base, color(backdrop.arcOrange), glow(arc.add(0.02), 0.06).mul(strength.mul(0.85)))
  );
  base.assign(mix(base, color(backdrop.arcPurple), glow(arc.sub(0.07), 0.06).mul(strength.mul(0.9))));
  base.assign(mix(base, color(backdrop.arcBlue), glow(arc.sub(0.18), 0.09).mul(strength.mul(0.9))));
}

/** Slow sine in [-1, 1] with a phase offset, for gently modulating the gradient. */
const drift = (speed: number, phase: number) => time.mul(speed).add(phase).sin();

/** Project each screen pixel onto a world plane behind the letters. */
const uv = Fn(() => {
  const aspect = screenSize.x.div(screenSize.y);
  const depth = float(-8);
  const view = getViewPosition(screenUV, float(0.5), cameraProjectionMatrixInverse);
  const direction = cameraWorldMatrix.mul(vec4(view, 0)).xyz.toVar();
  const distance = depth.sub(cameraPosition.z).div(direction.z);
  const point = cameraPosition.add(direction.mul(distance));

  // Normalize the field to the intro framing at z=12 with a 45 degree vertical FOV
  const height = float(12)
    .sub(depth)
    .mul(2 * Math.tan((45 * Math.PI) / 360));
  return vec2(point.x, point.y.negate()).div(height).add(vec2(aspect, 1).mul(0.5));
});

/**
 * The pastel gradient without grain: lavender base, a dusky rose band, and three rainbow arcs,
 * all slowly modulating. Coordinates follow the background plane with y down.
 * Shared by the backdrop and the letters, so text reads as a deeper cut of the same field.
 */
export const gradientNode = Fn(() => {
  const aspect = screenSize.x.div(screenSize.y);
  const p = uv().toVar();

  // Lavender base, slightly lighter toward the top; the split slides up and down
  const split = p.y.add(drift(0.21, 0.7).mul(0.12));
  const base = mix(color(backdrop.bottom), color(backdrop.top), split).toVar();

  // Dusky rose band across the upper middle, tilted a touch and slowly rising and falling
  const bandOffset = float(0.58).add(p.x.mul(0.04)).add(drift(0.27, 0).mul(0.06));
  const rose = glow(p.y.sub(bandOffset), 0.11);
  base.assign(mix(base, color(backdrop.rose), rose.mul(float(0.8).add(drift(0.19, 2.2).mul(0.15)))));

  // Rainbow arcs: one sweeping up from the lower left, a wide one falling in from the
  // upper right, and a small one tucked into the top left. Each wanders on its own cycle.
  paintArc(
    base,
    p,
    vec2(
      aspect.mul(0.25).add(drift(0.23, 1.1).mul(0.12)),
      float(-0.55).add(drift(0.17, 0.3).mul(0.1))
    ),
    float(0.95).add(drift(0.29, 1.3).mul(0.08)),
    float(1).add(drift(0.33, 0.4).mul(0.25))
  );
  paintArc(
    base,
    p,
    vec2(aspect.mul(0.9).add(drift(0.19, 2.9).mul(0.14)), float(1.55).add(drift(0.25, 1.7).mul(0.1))),
    float(1.15).add(drift(0.22, 2.9).mul(0.09)),
    float(0.85).add(drift(0.3, 1.9).mul(0.25))
  );
  paintArc(
    base,
    p,
    vec2(aspect.mul(0.05).add(drift(0.26, 4.1).mul(0.1)), float(1.3).add(drift(0.2, 3.7).mul(0.1))),
    float(0.6).add(drift(0.35, 4.1).mul(0.06)),
    float(0.65).add(drift(0.28, 3.3).mul(0.2))
  );

  return base;
});

/** The gradient and breathing grain share the same background plane. */
const backdropNode = Fn(() => {
  const base = gradientNode();

  // Fixed density on the plane makes the grain move and grow with the gradient
  const p = uv().mul(800).toVar();
  const cell = p.floor();
  const blend = p.fract();
  const seed = cell.x.add(cell.y.mul(4096));

  // Bilinear sampling lets the texture move smoothly between grain cells
  const sample = (offset: number) =>
    mix(
      mix(hash(seed.add(offset)), hash(seed.add(offset + 1)), blend.x),
      mix(hash(seed.add(offset + 4096)), hash(seed.add(offset + 4097)), blend.x),
      blend.y
    );
  const layerA = sample(0);
  const layerB = sample(7919);
  const breathe = time.mul(0.9).sin().mul(0.5).add(0.5);
  const grain = mix(layerA, layerB, breathe).sub(0.5).mul(backdrop.grain);

  return vec4(base.add(grain), 1);
});
/* oxlint-enable typescript/no-explicit-any */

export function Background() {
  const scene = useThree((state) => state.scene);
  const renderer = useThree((state) => state.renderer);
  const shader = backdropNode;

  /* oxlint-disable react/immutability */
  useEffect(() => {
    // Pastels get compressed by filmic tone mapping, so output the colors as authored
    const prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = NoToneMapping;
    scene.backgroundNode = shader();
    return () => {
      scene.backgroundNode = null;
      renderer.toneMapping = prevToneMapping;
    };
  }, [scene, renderer, shader]);
  /* oxlint-enable react/immutability */

  return null;
}
