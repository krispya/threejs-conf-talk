import { createPortal, useFrame, useThree, type ThreeCamera } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { easing } from 'math/time';
import { Suspense, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { color, mix, pass, screenUV, uniform, vec4 } from 'three/tsl';
import { NodeUpdateType, RenderPipeline, Scene, type Group } from 'three/webgpu';
import { ActiveScreen, Screen, ScreenTransition, Timeline } from '../sim/index.js';
import { ramp } from '../theme.js';
import { CharterRenderer } from './renderers/charter-renderer.js';
import { AnnouncementRenderer } from './renderers/announcement-renderer.js';
import { GreetingRenderer } from './renderers/greeting-renderer.js';
import { HistoryRenderer } from './renderers/history-renderer.js';
import { PrinciplesRenderer } from './renderers/principles-renderer.js';
import { useTransitionOpacity } from './use-transition-opacity.js';
import { warmUp } from './warm-up.js';

/** Composite foreground screens over the scene, with a soft focus for the greeting. */
export function GreetingLayer() {
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const greeting = data?.greetingVisible ?? false;
  const history = (data?.historyPages ?? 0) > 0;
  const principles = data?.principlesVisible ?? false;
  const charter = useTransitionOpacity(data?.charterVisible ?? false);
  const announcement = useTransitionOpacity(data?.announcementVisible ?? false);
  const panelVisible = principles || (data?.charterVisible ?? false);
  const transition = useTrait(screen, ScreenTransition);
  const panel = useTransitionOpacity(panelVisible, {
    duration: panelVisible ? Math.max(0.1, (transition?.revealDelay ?? 1.75) - 0.15) : 1.1,
    ease: easing.cubicInOut,
  });
  const amount = useTransitionOpacity(greeting || history, {
    duration: greeting || history ? 1.1 : 1.3,
    ease: greeting || history ? easing.cubicOut : easing.cubicInOut,
  });
  const [foreground] = useState(() => new Scene());
  const effect = useMemo(() => {
    const scenePass = pass(scene, camera);
    const foregroundPass = pass(foreground, camera);
    const radius = uniform(0);
    // Explicit screen coordinates prevent the background sphere from supplying its own UVs.
    const sceneTexture = scenePass.getTextureNode().sample(screenUV);
    const blurred = gaussianBlur(sceneTexture, radius, 8);
    const background = mix(
      mix(sceneTexture, blurred, amount),
      vec4(color(ramp['light-25']), 1),
      amount.mul(0.1)
    );
    const overlay = foregroundPass.getTextureNode();
    // Render targets contain premultiplied color, so composite before the output transform.
    const pipeline = new RenderPipeline(
      renderer,
      vec4(
        background.rgb.mul(overlay.a.oneMinus()).add(overlay.rgb),
        overlay.a.add(background.a.mul(overlay.a.oneMinus()))
      )
    );
    return {
      scenePass,
      foregroundPass,
      background,
      radius,
      blurred,
      pipeline,
      warmed: false,
      preparedScreen: undefined as typeof screen,
      width: 0,
      height: 0,
      pixelRatio: 0,
      pendingGreeting: null as Group | null,
      count: -1,
      stable: 0,
      warmedCount: -1,
    };
  }, [renderer, scene, foreground, camera, amount]);

  // These objects are owned by this compositor and updated before rendering.
  /* oxlint-disable react/immutability */
  useLayoutEffect(() => {
    const previousBackground = foreground.backgroundNode;
    // Viewport lens and warp samples must contain the live sky beneath the foreground.
    foreground.backgroundNode = effect.background;
    return () => {
      foreground.backgroundNode = previousBackground;
      effect.pipeline.dispose();
      effect.blurred.dispose();
      effect.scenePass.dispose();
      effect.foregroundPass.dispose();
    };
  }, [effect, foreground]);

  const prepareGreeting = useCallback(
    (group: Group) => {
      effect.pendingGreeting = group;
    },
    [effect]
  );

  useFrame(
    ({ size }) => {
      const pixelRatio = renderer.getPixelRatio();
      // Foreground renderers mount as their assets resolve, so compile the foreground pass
      // again whenever its object count settles. The pass targets exist after the first render.
      if (effect.warmed) {
        let count = 0;
        foreground.traverse(() => count++);
        if (count !== effect.count) {
          effect.count = count;
          effect.stable = 0;
        } else if (effect.warmedCount !== count && ++effect.stable >= 30) {
          effect.warmedCount = count;
          void warmUp(renderer, foreground, camera, foreground, effect.foregroundPass.renderTarget);
          void warmUp(renderer, scene, camera, scene, effect.scenePass.renderTarget);
        }
      }
      // The blur passes only run while the soft focus contributes. At zero it is mixed out
      // exactly, so the sharp frames skip two full resolution passes.
      const blurring = amount.value > 0 || !effect.warmed || !!effect.pendingGreeting;
      effect.blurred.updateBeforeType = blurring ? NodeUpdateType.FRAME : NodeUpdateType.NONE;
      // Prepare the blur on screen or viewport changes, then bypass it while sharp.
      if (
        !effect.warmed ||
        (data?.profilesVisible &&
          (effect.preparedScreen !== screen ||
            effect.width !== size.width ||
            effect.height !== size.height ||
            effect.pixelRatio !== pixelRatio)) ||
        effect.pendingGreeting ||
        amount.value > 0 ||
        panel.value > 0 ||
        charter.value > 0 ||
        announcement.value > 0 ||
        panelVisible ||
        greeting
      ) {
        foreground.environment = scene.environment;
        foreground.environmentIntensity = scene.environmentIntensity;
        effect.radius.value = (amount.value || 1) * pixelRatio * 2;
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
        effect.preparedScreen = screen;
        effect.width = size.width;
        effect.height = size.height;
        effect.pixelRatio = pixelRatio;
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
      <ForegroundCamera camera={camera} />
      <directionalLight position={[3, 4, 6]} intensity={2} />
      <Suspense fallback={null}>
        <GreetingRenderer camera={camera} onReady={prepareGreeting} />
        <PrinciplesRenderer camera={camera} panel={panel} />
      </Suspense>
      <Suspense fallback={null}>
        <HistoryRenderer />
      </Suspense>
      <Suspense fallback={null}>
        <CharterRenderer />
        <AnnouncementRenderer />
      </Suspense>
    </>,
    foreground,
    { camera }
  );
}

/** Keep portal animations and raycasting on the camera used by the compositor. */
function ForegroundCamera({ camera }: { camera: ThreeCamera }) {
  const set = useThree((state) => state.set);
  useLayoutEffect(() => {
    set({ camera });
  }, [camera, set]);
  return null;
}
