import { Suspense } from 'react';
import { TransmissionBackdropProvider } from './glass/transmission-backdrop-provider.js';
import { CameraRenderer } from './renderers/camera-renderer.js';
import { CodeComparisonRenderer } from './renderers/code-comparison-renderer.js';
import { LetterRenderer } from './renderers/letter-renderer.js';
import { PackageRenderer } from './renderers/package-renderer.js';
import { ProfileRenderer } from './renderers/profile-renderer.js';
import { TitleRenderer } from './renderers/title-renderer.js';

export function Renderers() {
  return (
    <>
      <CameraRenderer />
      <Suspense fallback={null}>
        <TitleRenderer />
      </Suspense>
      <TransmissionBackdropProvider>
        <Suspense fallback={null}>
          <LetterRenderer />
          <PackageRenderer />
        </Suspense>
      </TransmissionBackdropProvider>
      <Suspense fallback={null}>
        <CodeComparisonRenderer />
        <ProfileRenderer />
      </Suspense>
    </>
  );
}
