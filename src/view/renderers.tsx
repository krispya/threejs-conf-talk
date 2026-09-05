import { Suspense } from 'react';
import { TransmissionBackdropProvider } from './glass/transmission-backdrop-provider.js';
import { CameraRenderer } from './renderers/camera-renderer.js';
import { LetterRenderer } from './renderers/letter-renderer.js';
import { PackageRenderer } from './renderers/package-renderer.js';
import { ProfileRenderer } from './renderers/profile-renderer.js';

export function Renderers() {
  return (
    <>
      <CameraRenderer />
      <TransmissionBackdropProvider>
        <Suspense fallback={null}>
          <LetterRenderer />
          <PackageRenderer />
        </Suspense>
      </TransmissionBackdropProvider>
      <Suspense fallback={null}>
        <ProfileRenderer />
      </Suspense>
    </>
  );
}
