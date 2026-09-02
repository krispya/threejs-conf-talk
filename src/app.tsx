import { Canvas } from '@react-three/fiber/webgpu';
import { WorldProvider } from 'koota/react';
import { Suspense } from 'react';
import { world } from './sim/index.js';
import { theme } from './theme.js';
import { FrameLoop } from './view/frameloop.js';
import { Renderers } from './view/renderers.js';
import { Startup } from './view/startup.js';

export function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 45, near: 0.1, far: 100 }}
      fallback={<div className="fallback">WebGPU or WebGL2 is required.</div>}
    >
      <color attach="background" args={[theme.background]} />
      <WorldProvider world={world}>
        <Suspense fallback={null}>
          <Renderers />
        </Suspense>
        <FrameLoop />
        <Startup />
      </WorldProvider>
    </Canvas>
  );
}
