import { trait } from 'koota';
import type { TransmissionBackdrop } from './transmission-backdrop.js';

/** Glass capture resources registered by the mounted provider. */
export const Backdrop = trait(() => null! as TransmissionBackdrop);
