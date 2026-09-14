import { trait } from 'koota';
import type { UniformNode } from 'three/webgpu';
import type { ShowreelMotion } from './showreel/motion.js';
import type { ShowreelSource } from './showreel/source.js';

/** Video wall resources and motion, registered by the background while it is mounted. */
export const Showreel = trait(() => ({
  source: null! as ShowreelSource,
  motion: null! as ShowreelMotion,
  opacity: null! as UniformNode<'float', number>,
  blackout: null! as UniformNode<'float', number>,
}));
