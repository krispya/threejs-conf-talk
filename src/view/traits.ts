import { trait } from 'koota';
import type { Object3D } from 'three/webgpu';

/** Three object owned by the mounted view. */
export const Ref = trait(() => null! as Object3D);
