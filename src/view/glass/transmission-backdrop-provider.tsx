import { createContext, useContext, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TransmissionBackdropManager } from './transmission-backdrop.js';

const BackdropContext = createContext<TransmissionBackdropManager | null>(null);

/** Owns the shared capture targets for one scene across its screen changes */
export function TransmissionBackdropProvider({ children }: { children: ReactNode }) {
  const [backdrop] = useState(() => new TransmissionBackdropManager());

  useLayoutEffect(() => () => backdrop.dispose(), [backdrop]);

  return <BackdropContext value={backdrop}>{children}</BackdropContext>;
}

export function useTransmissionBackdrop() {
  const backdrop = useContext(BackdropContext);
  if (!backdrop) throw new Error('GlassMaterial requires a TransmissionBackdropProvider');
  return backdrop;
}
