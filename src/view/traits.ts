import { trait } from 'koota';
import type { Object3D, UniformNode } from 'three/webgpu';
import type { TransmissionBackdrop } from './glass/transmission-backdrop.js';

// Three object owned by the mounted view.

export const Ref = trait(() => null! as Object3D);

// Shader uniform that mirrors a world transition's value for the materials that read it.

export const TransitionUniform = trait(() => null! as UniformNode<'float', number>);

// Glass capture resources, registered by the provider while it is mounted.

export const Backdrop = trait(() => null! as TransmissionBackdrop);
