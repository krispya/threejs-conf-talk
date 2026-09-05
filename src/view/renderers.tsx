import { Suspense } from 'react';
import { CameraRenderer } from './renderers/camera-renderer.js';
import { LetterRenderer } from './renderers/letter-renderer.js';
import { PackageRenderer } from './renderers/package-renderer.js';

export function Renderers() {
  return (
    <>
      <CameraRenderer />
      <Suspense fallback={null}>
        <LetterRenderer />
        <PackageRenderer />
      </Suspense>
    </>
  );
}
