import { useThree } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Fn,
  If,
  atan,
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
import { ActiveScreen, Screen, Timeline } from '../sim/index.js';
import { backdrop, brand } from '../theme.js';
import { useTransitionOpacity } from './use-transition-opacity.js';
import { useShowreel } from './use-showreel.js';
import { bakeNebula, starfieldNode } from './starfield.js';
import { usePortal } from './use-portal.js';
import { usePortalRipples } from './use-portal-ripples.js';

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

/** Colored rings stretch into asymmetric loops during the pullback. */
function paintArc(base: N, p: N, center: N, radius: N, strength: N, morph: N, phase: number) {
  const motion = time.mul(0.35).add(morph.mul(4)).add(phase);
  const stretch = motion.sin().mul(morph).mul(0.4).add(1);
  const delta = p.sub(center);
  const local = vec2(delta.x.mul(stretch), delta.y.div(stretch)).toVar();
  const angle = atan(local.y, local.x);
  const contour = angle
    .mul(3)
    .add(motion)
    .sin()
    .mul(0.17)
    .add(angle.mul(2).sub(motion.mul(0.7)).sin().mul(0.12))
    .mul(morph)
    .mul(radius);
  const arc: N = length(local).sub(radius).sub(contour);
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
  const depth = float(-24);
  const view = getViewPosition(screenUV, float(0.5), cameraProjectionMatrixInverse);
  const direction = cameraWorldMatrix.mul(vec4(view, 0)).xyz.toVar();
  const distance = depth.sub(cameraPosition.z).div(direction.z);
  const point = cameraPosition.add(direction.mul(distance));

  // Normalize the field to the intro framing at z=12 with a 45 degree vertical FOV
  const height = float(12)
    .sub(depth)
    .mul(2 * Math.tan((45 * Math.PI) / 360));
  const p = vec2(point.x, point.y.negate()).div(height).toVar();
  const pullback = cameraPosition.z.sub(12).div(108).clamp();
  const flow = time.mul(0.22).add(pullback.mul(3));

  // A radial twist unfolds as the camera leaves the intro framing
  const angle = pullback.mul(p.length().mul(0.9).sub(flow).sin().mul(0.25).add(0.65)).toVar();
  p.assign(
    vec2(
      p.x.mul(angle.cos()).sub(p.y.mul(angle.sin())),
      p.x.mul(angle.sin()).add(p.y.mul(angle.cos()))
    )
  );
  // Let the shapes expand during the pullback so their motion stays readable
  p.divAssign(pullback.mul(1.3).add(1));
  return p.add(vec2(aspect, 1).mul(0.5));
});

/**
 * The pastel gradient without grain: lavender base, a dusky rose band, and three rainbow arcs,
 * all slowly modulating. Coordinates follow the background plane with y down.
 * Shared by the backdrop and the letters, so text reads as a deeper cut of the same field.
 */
export const gradientNode = Fn(() => {
  const aspect = screenSize.x.div(screenSize.y);
  const p = uv().toVar();
  const morph = cameraPosition.z.sub(12).div(108).clamp();

  // Lavender base, slightly lighter toward the top; the split slides up and down
  const split = p.y.add(drift(0.21, 0.7).mul(0.12)).clamp();
  const base = mix(color(backdrop.bottom), color(backdrop.top), split).toVar();

  // The rose band curls into a flowing ribbon as the rings change shape
  const bend = p.x
    .mul(2.4)
    .sub(time.mul(0.3))
    .add(morph.mul(3.8))
    .sin()
    .mul(0.42)
    .add(p.x.mul(4.1).add(time.mul(0.21)).sin().mul(0.12))
    .mul(morph);
  const bandOffset = float(0.58).add(p.x.mul(0.04)).add(drift(0.27, 0).mul(0.06)).add(bend);
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
    float(1).add(drift(0.33, 0.4).mul(0.25)),
    morph,
    0
  );
  paintArc(
    base,
    p,
    vec2(aspect.mul(0.9).add(drift(0.19, 2.9).mul(0.14)), float(1.55).add(drift(0.25, 1.7).mul(0.1))),
    float(1.15).add(drift(0.22, 2.9).mul(0.09)),
    float(0.85).add(drift(0.3, 1.9).mul(0.25)),
    morph,
    2.1
  );
  paintArc(
    base,
    p,
    vec2(aspect.mul(0.05).add(drift(0.26, 4.1).mul(0.1)), float(1.3).add(drift(0.2, 3.7).mul(0.1))),
    float(0.6).add(drift(0.35, 4.1).mul(0.06)),
    float(0.65).add(drift(0.28, 3.3).mul(0.2)),
    morph,
    4.2
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
  // Preserve negative cells when the hash converts its seed to an unsigned integer
  const noise = (offset: number) => hash(seed.add(offset).toInt());

  // Bilinear sampling lets the texture move smoothly between grain cells
  const sample = (offset: number) =>
    mix(
      mix(noise(offset), noise(offset + 1), blend.x),
      mix(noise(offset + 4096), noise(offset + 4097), blend.x),
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
  // The nebula bakes once and the star shader samples it for the rest of the session
  const [nebula] = useState(() => bakeNebula(renderer));
  const ripples = usePortalRipples();
  const [starsShader] = useState(() => starfieldNode(nebula.texture, ripples.uv));
  useEffect(() => () => nebula.dispose(), [nebula]);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const { progress: portalProgress, angle, distance, energy, edge, aperture } = usePortal();
  const solid = !data || data.background === 'solid';
  const closing = data?.background === 'blue';
  const opacity = useTransitionOpacity(data?.backgroundVisible ?? true);
  const stars = useTransitionOpacity(data?.background === 'stars', { delayed: true });
  const reel = useShowreel();
  const background = useMemo(
    () =>
      Fn(() => {
        const field = vec4(0).toVar();
        // Hold the pastel shapes through more of the pullback before revealing the stars
        const starMix = stars.pow(3);
        // Retain both styles while skipping the inactive background's fragment work
        If(stars.lessThan(1), () => {
          field.addAssign(shader().mul(starMix.oneMinus()));
        });
        If(stars.greaterThan(0), () => {
          const sky = starsShader();
          field.addAssign(vec4(sky.rgb.mul(ripples.light.add(1)), sky.a).mul(starMix));
        });
        return mix(vec4(color(backdrop.top), 1), field, opacity);
      })(),
    [shader, starsShader, opacity, stars, ripples]
  );
  const portal = useMemo(
    () =>
      Fn(() => {
        const rim = mix(
          color(brand.blue),
          color(brand.purple),
          angle.mul(2).add(portalProgress.mul(9)).sin().mul(0.5).add(0.5)
        );
        const outside = mix(
          color(brand.green),
          color('#18152f'),
          glow(edge.sub(0.1), 0.2).mul(energy).mul(0.8)
        );
        const tunnel = angle
          .mul(72)
          .sub(distance.mul(24))
          .add(portalProgress.mul(50))
          .sin()
          .mul(0.5)
          .add(0.5)
          .pow(12);
        return vec4(
          mix(outside, background.rgb, aperture)
            .add(rim.mul(glow(edge, 0.09)).mul(energy).mul(tunnel.mul(0.6).add(0.7)))
            .add(color('#f2ffff').mul(glow(edge, 0.014)).mul(energy)),
          1
        );
      })(),
    [background, portalProgress, angle, distance, energy, edge, aperture]
  );

  const composed = useMemo(
    () =>
      Fn(() => {
        const base = vec4(
          data?.warpVisible
            ? portal
            : closing
              ? color(brand.blue)
              : solid
                ? color(brand.green)
                : background
        ).toVar();
        If(reel.opacity.greaterThan(0), () => {
          const video = reel.source.node.rgb.mul(reel.blackout.oneMinus());
          base.assign(mix(base, vec4(video, 1), reel.opacity));
        });
        return base;
      })(),
    [data?.warpVisible, portal, closing, solid, background, reel]
  );

  /* oxlint-disable react/immutability */
  useLayoutEffect(() => {
    const prevToneMapping = renderer.toneMapping;
    const prevBackground = scene.background;
    const prevBackgroundNode = scene.backgroundNode;
    renderer.toneMapping = NoToneMapping;
    scene.background = null;
    scene.backgroundNode = composed;
    return () => {
      scene.background = prevBackground;
      scene.backgroundNode = prevBackgroundNode;
      renderer.toneMapping = prevToneMapping;
    };
  }, [scene, renderer, composed]);
  /* oxlint-enable react/immutability */

  return null;
}
