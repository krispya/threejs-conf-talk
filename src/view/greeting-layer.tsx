import { createPortal, useFrame, useThree } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { easing } from 'math/time';
import { Suspense, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { color, mix, pass, uniform, vec4 } from 'three/tsl';
import { RenderPipeline, Scene, type Group } from 'three/webgpu';
import { ActiveScreen, Screen, Timeline } from '../sim/index.js';
import { ramp } from '../theme.js';
import { GreetingRenderer } from './renderers/greeting-renderer.js';
import { useTransitionOpacity } from './use-transition-opacity.js';

/** Blur the existing scene before drawing the greeting in the foreground. */
export function GreetingLayer() {
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const greeting = data?.greetingVisible ?? false;
  const amount = useTransitionOpacity(greeting, {
    duration: greeting ? 1.1 : 1.3,
    ease: greeting ? easing.cubicOut : easing.cubicInOut,
  });
  const [foreground] = useState(() => new Scene());
  const effect = useMemo(() => {
    const scenePass = pass(scene, camera);
    const foregroundPass = pass(foreground, camera);
    const radius = uniform(0);
    const blurred = gaussianBlur(scenePass.getTextureNode(), radius, 8);
    const background = mix(
      mix(scenePass.getTextureNode(), blurred, amount),
      vec4(color(ramp['light-25']), 1),
      amount.mul(0.1)
    );
    const overlay = foregroundPass.getTextureNode();
    // Render targets contain premultiplied color, so composite before the output transform.
    const pipeline = new RenderPipeline(
      renderer,
      vec4(overlay.rgb.add(background.rgb.mul(overlay.a.oneMinus())), 1)
    );
    return {
      scenePass,
      foregroundPass,
      radius,
      blurred,
      pipeline,
      warmed: false,
      pendingGreeting: null as Group | null,
    };
  }, [renderer, scene, foreground, camera, amount]);

  useLayoutEffect(
    () => () => {
      effect.pipeline.dispose();
      effect.blurred.dispose();
      effect.scenePass.dispose();
      effect.foregroundPass.dispose();
    },
    [effect]
  );

  // These objects are owned by this compositor and updated before rendering.
  /* oxlint-disable react/immutability */
  const prepareGreeting = useCallback(
    (group: Group) => {
      effect.pendingGreeting = group;
    },
    [effect]
  );

  useFrame(
    () => {
      // Keep the compositor ready while the profiles are sharp, before shifting focus.
      if (
        !effect.warmed ||
        data?.profilesVisible ||
        effect.pendingGreeting ||
        amount.value > 0 ||
        greeting
      ) {
        foreground.environment = scene.environment;
        foreground.environmentIntensity = scene.environmentIntensity;
        effect.radius.value = (amount.value || 1) * renderer.getPixelRatio() * 2;
        const restore: (() => void)[] = [];
        if (effect.pendingGreeting && !greeting) {
          effect.pendingGreeting.traverse((child) => {
            const { visible, frustumCulled } = child;
            child.visible = true;
            child.frustumCulled = false;
            restore.push(() => {
              child.visible = visible;
              child.frustumCulled = frustumCulled;
            });
          });
        }
        try {
          effect.pipeline.render();
        } finally {
          for (const undo of restore) undo();
        }
        effect.warmed = true;
        effect.pendingGreeting = null;
      } else {
        renderer.render(scene, camera);
      }
    },
    { phase: 'render' }
  );
  /* oxlint-enable react/immutability */

  return createPortal(
    <>
      <directionalLight position={[3, 4, 6]} intensity={2} />
      <Suspense fallback={null}>
        <GreetingRenderer camera={camera} onReady={prepareGreeting} />
      </Suspense>
    </>,
    foreground
  );
}
