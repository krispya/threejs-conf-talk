import { useFrame } from '@react-three/fiber/webgpu';
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  captureTransmissionBackdrop,
  createTransmissionBackdrop,
  disposeTransmissionBackdrop,
  type TransmissionBackdrop,
} from './transmission-backdrop.js';

const BackdropContext = createContext<TransmissionBackdrop | null>(null);

/** Capture quality and scheduling belong to the scene, not to individual materials. */
export function TransmissionBackdropProvider({
  children,
  resolution = 0.85,
  backsideResolution = 0.7,
}: {
  children: ReactNode;
  resolution?: number;
  backsideResolution?: number;
}) {
  const [backdrop] = useState(createTransmissionBackdrop);
  useLayoutEffect(() => {
    // Capture resources are mutable render state, independent of React's display state.
    /* oxlint-disable react/immutability */
    backdrop.resolution = resolution;
    backdrop.backsideResolution = backsideResolution;
    /* oxlint-enable react/immutability */
  }, [backdrop, resolution, backsideResolution]);
  useLayoutEffect(() => () => disposeTransmissionBackdrop(backdrop), [backdrop]);
  useFrame(
    (state) => {
      for (const material of backdrop.materials.keys())
        material.transmissionUniforms.time.value = state.elapsed;
      captureTransmissionBackdrop(backdrop, state.renderer, state.scene, state.camera, state.frame);
    },
    { priority: -1 }
  );
  return <BackdropContext value={backdrop}>{children}</BackdropContext>;
}

export function useTransmissionBackdrop() {
  const backdrop = useContext(BackdropContext);
  if (!backdrop) throw new Error('GlassMaterial requires a TransmissionBackdropProvider');
  return backdrop;
}
