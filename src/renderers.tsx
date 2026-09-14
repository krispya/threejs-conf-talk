import { Suspense } from 'react';
import { CameraRenderer } from './camera/renderer.js';
import { ClosingRenderer } from './closing/renderer.js';
import { CodeComparisonRenderer } from './package/comparison/renderer.js';
import { LetterRenderer } from './letter/renderer.js';
import { InitiativeRenderer } from './initiative/renderer.js';
import { PackageRenderer } from './package/renderer.js';
import { ProfileRenderer } from './profile/renderer.js';
import { RobotReveal } from './robot/renderer.js';
import { TeamConnections } from './profile/team-connections.js';
import { Foreground } from './foreground.js';
import { TitleRenderer } from './title/renderer.js';

export function Renderers() {
  return (
    <>
      <CameraRenderer />
      <Suspense fallback={null}>
        <TitleRenderer />
      </Suspense>
      <Suspense fallback={null}>
        <LetterRenderer />
        <PackageRenderer />
      </Suspense>
      <Suspense fallback={null}>
        <CodeComparisonRenderer />
        <ProfileRenderer />
      </Suspense>
      <Foreground />
      <Suspense fallback={null}>
        <RobotReveal variant="community" />
        <TeamConnections />
        <TeamConnections story />
      </Suspense>
      <Suspense fallback={null}>
        <InitiativeRenderer />
      </Suspense>
      <Suspense fallback={null}>
        <ClosingRenderer />
      </Suspense>
    </>
  );
}
