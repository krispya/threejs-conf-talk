import { trait } from 'koota';

// Bodies drift around their anchors with a gentle orbit and tilt.

export const Anchor = trait({ x: 0, y: 0, z: 0 });
export const Float = trait({ phase: 0, speed: 1, amplitude: 0.25, tilt: 0.12 });
