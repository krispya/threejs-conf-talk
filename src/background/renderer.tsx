import { type Node, Group, NoToneMapping } from 'three/webgpu';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { backdropNode, glow } from './utils/gradient.js';
import { useActiveScreen } from '../timeline/hooks.js';
import { useFrame, useLoader, useThree } from '@react-three/fiber/webgpu';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Fn, If, color, mix, vec4 } from 'three/tsl';
import { backdrop, brand } from '../theme.js';
import { useTransitionOpacity } from '../view/use-transition-opacity.js';
import { useShowreel } from './showreel/use-showreel.js';
import { starfieldNode } from './utils/starfield.js';
import { initiativeCover } from '../initiative/utils/portal.js';
import { usePortal, usePortalRipples } from '../title/use-portal.js';
import { useTransmissionBackdrop } from '../view/glass/transmission-backdrop-provider.js';
import { warmUp } from '../view/utils/warm-up.js';

useLoader.preload(EXRLoader, './sky/nebula.exr');

export function Background() {
  const nebula = useLoader(EXRLoader, './sky/nebula.exr');
  const scene = useThree((state) => state.scene);
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const capture = useTransmissionBackdrop();
  const shader = backdropNode;
  const ripples = usePortalRipples();
  const starsShader = useMemo(() => starfieldNode(nebula, ripples.uv), [nebula, ripples.uv]);
  const { data } = useActiveScreen();
  const portalOpening = usePortal();
  const { progress: portalProgress, angle, distance, energy, edge, aperture } = portalOpening;
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
        // Retain both styles while skipping the inactive background's fragment work, and skip
        // all of it while the initiative preview is opaque across the frame
        If(initiativeCover.lessThan(1), () => {
          If(stars.lessThan(1), () => {
            field.addAssign(shader().mul(starMix.oneMinus()));
          });
          If(stars.greaterThan(0), () => {
            const sky = starsShader();
            field.addAssign(vec4(sky.rgb.mul(ripples.light.add(1)), sky.a).mul(starMix));
          });
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

  // Each backdrop style keeps one node for the whole talk, so switching styles reuses shaders
  // that were compiled ahead instead of rebuilding them mid transition
  const variants = useMemo(() => {
    const compose = (style: Node<'vec4'>) =>
      Fn(() => {
        const base = vec4(style).toVar();
        If(reel.opacity.greaterThan(0), () => {
          const video = reel.source.node.rgb.mul(reel.blackout.oneMinus());
          base.assign(mix(base, vec4(video, 1), reel.opacity));
        });
        return base;
      })();
    return {
      warp: compose(portal),
      closing: compose(vec4(color(brand.blue), 1)),
      solid: compose(vec4(color(brand.green), 1)),
      pastel: compose(background),
    };
  }, [portal, background, reel]);
  const composed =
    variants[data?.warpVisible ? 'warp' : closing ? 'closing' : solid ? 'solid' : 'pastel'];
  const warmed = useRef<typeof variants | null>(null);
  useFrame((state, delta) => {
    // The backdrop's own copy of the opening follows the same clock as the title's
    portalOpening.step(state, delta);
    if (warmed.current === variants || !renderer.hasInitialized()) return;
    warmed.current = variants;
    const probe = new Group();
    for (const variant of Object.values(variants)) {
      /* oxlint-disable react/immutability */
      scene.backgroundNode = variant;
      void warmUp(renderer, probe, camera, scene);
      void warmUp(renderer, probe, camera, scene, capture.cleanTarget);
    }
    scene.backgroundNode = composed;
    /* oxlint-enable react/immutability */
  });

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
