import { trait } from 'koota';

export const Camera = trait({ fov: 45, near: 0.1, far: 5000 });

export const Bounds = trait({ width: 0, height: 0 });
export const TargetPosition = trait({ x: 0, y: 0, z: 0 });
