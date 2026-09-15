import { Canvas, useThree } from '@react-three/fiber/webgpu';
import { useActions } from 'koota/react';
import { useEffect, useLayoutEffect } from 'react';
import { actions } from './actions.js';
import { screens } from './timeline/screens.js';
import { Background } from './background/renderer.js';
import { BrandMark } from './title/brand-mark.js';
import { Environment } from './view/environment.js';
import { FrameLoop } from './frameloop.js';
import { Prewarm } from './view/prewarm.js';
import { Renderers } from './renderers.js';
import { TransmissionBackdropProvider } from './glass/transmission-backdrop-provider.js';
import { TimelineControls } from './timeline/controls.js';

export function App() {
  return (
    <>
      <Canvas shadows>
        <TransmissionBackdropProvider>
          <Background />
          <Environment intensity={0.4} />
          <directionalLight position={[3, 4, 6]} intensity={2} />

          <Renderers />

          <FrameLoop />
          <Prewarm />
          <ResolutionCap width={1920} />
          <Startup />
          <TimelineControls />
        </TransmissionBackdropProvider>
      </Canvas>
      <BrandMark />
    </>
  );
}

function Startup() {
  const { createTimeline, startTimeline, destroyTimeline } = useActions(actions);

  useEffect(() => {
    const timeline = createTimeline(screens);
    startTimeline(timeline);
    return () => destroyTimeline(timeline);
  }, [createTimeline, startTimeline, destroyTimeline]);

  return null;
}

/** Keep the drawing buffer at most this many pixels wide, so retina and 4K outputs render like 1080p. */
function ResolutionCap({ width }: { width: number }) {
  const size = useThree((state) => state.size);
  const setDpr = useThree((state) => state.setDpr);
  useLayoutEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, width / size.width));
  }, [size.width, width, setDpr]);
  return null;
}
