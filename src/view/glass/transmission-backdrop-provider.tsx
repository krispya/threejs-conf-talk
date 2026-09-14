import { createContext, useContext, useLayoutEffect, type ReactNode, useMemo } from 'react';
import { useSpawnedParts } from '../hooks.js';
import { Backdrop } from '../traits.js';
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
  const backdrop = useMemo(() => createTransmissionBackdrop(), []);
  useLayoutEffect(() => {
    // Capture resources are mutable render state, independent of React's display state.
    /* oxlint-disable react/immutability */
    backdrop.resolution = resolution;
    backdrop.backsideResolution = backsideResolution;
    /* oxlint-enable react/immutability */
  }, [backdrop, resolution, backsideResolution]);
  useLayoutEffect(() => () => disposeTransmissionBackdrop(backdrop), [backdrop]);
  useSpawnedParts(Backdrop, backdrop);
  return <BackdropContext value={backdrop}>{children}</BackdropContext>;
}

export function useTransmissionBackdrop() {
  const backdrop = useContext(BackdropContext);
  if (!backdrop) throw new Error('GlassMaterial requires a TransmissionBackdropProvider');
  return backdrop;
}
