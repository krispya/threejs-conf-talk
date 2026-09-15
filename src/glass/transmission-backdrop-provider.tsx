import { useResource, useSpawnedParts } from '../view/hooks.js';
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { Backdrop } from './traits.js';
import {
  createTransmissionBackdrop,
  disposeTransmissionBackdrop,
  type TransmissionBackdrop,
} from './transmission-backdrop.js';

const BackdropContext = createContext<TransmissionBackdrop | null>(null);

/**
 * Capture quality belongs to the scene, not to individual materials. `captureBackdrop` runs
 * the capture after every view callback has placed its objects for the frame.
 */
export function TransmissionBackdropProvider({
  children,
  resolution = 0.85,
  backsideResolution = 0.7,
}: {
  children: ReactNode;
  resolution?: number;
  backsideResolution?: number;
}) {
  const [backdrop, backdropRef] = useResource(
    createTransmissionBackdrop,
    disposeTransmissionBackdrop,
    []
  );
  useLayoutEffect(() => {
    const capture = backdropRef.current;
    if (!capture) return;
    capture.resolution = resolution;
    capture.backsideResolution = backsideResolution;
  }, [backdrop, backdropRef, resolution, backsideResolution]);
  useSpawnedParts(Backdrop, backdrop);
  return backdrop ? <BackdropContext value={backdrop}>{children}</BackdropContext> : null;
}

export function useTransmissionBackdrop() {
  const backdrop = useContext(BackdropContext);
  if (!backdrop) throw new Error('GlassMaterial requires a TransmissionBackdropProvider');
  return backdrop;
}
