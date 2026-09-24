import { trait } from 'koota';
import type { Group } from 'three/webgpu';

export const Charter = trait();

/** The black hole that takes the announcement, registered by its view while mounted. */
export const BlackHoleParts = trait(() => ({ hole: null as Group | null }));
