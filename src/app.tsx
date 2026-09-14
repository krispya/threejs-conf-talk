import { Canvas } from '@react-three/fiber/webgpu';
import { Background } from './background/renderer.js';
import { BrandMark } from './view/brand-mark.js';
import { Environment } from './view/environment.js';
import { FrameLoop } from './frameloop.js';
import { Prewarm } from './view/prewarm.js';
import { Renderers } from './renderers.js';
import { ResolutionCap } from './view/resolution-cap.js';
import { TransmissionBackdropProvider } from './view/glass/transmission-backdrop-provider.js';
import { Startup } from './startup.js';
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
