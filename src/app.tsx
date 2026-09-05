import { Canvas } from '@react-three/fiber/webgpu';
import { Background } from './view/background.js';
import { Environment } from './view/environment.js';
import { FrameLoop } from './view/frameloop.js';
import { Renderers } from './view/renderers.js';
import { Startup } from './view/startup.js';
import { TimelineControls } from './view/timeline-controls.js';

export function App() {
  return (
    <Canvas>
      <Background />
      <Environment intensity={0.4} />
      <directionalLight position={[3, 4, 6]} intensity={2} />

      <Renderers />

      <FrameLoop />
      <Startup />
      <TimelineControls />
    </Canvas>
  );
}
