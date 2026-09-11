import { Suspense } from 'react';
import { CameraRenderer } from './renderers/camera-renderer.js';
import { ClosingRenderer } from './renderers/closing-renderer.js';
import { CodeComparisonRenderer } from './renderers/code-comparison-renderer.js';
import { LetterRenderer } from './renderers/letter-renderer.js';
import { InitiativeRenderer } from './renderers/initiative-renderer.js';
import { PackageRenderer } from './renderers/package-renderer.js';
import { ProfileRenderer } from './renderers/profile-renderer.js';
import { RobotReveal } from './renderers/robot-reveal.js';
import { TeamConnections } from './renderers/team-connections.js';
import { GreetingLayer } from './greeting-layer.js';
import { TitleRenderer } from './renderers/title-renderer.js';

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
      <GreetingLayer />
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
