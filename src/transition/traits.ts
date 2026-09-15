import { trait } from 'koota';
import type { UniformNode } from 'three/webgpu';
import { easing } from 'math/time';

/** A normalized transition, independent of the object that displays it. */
export const Transition = trait({
  value: 0,
  from: 0,
  target: 0,
  startedAt: 0,
  duration: 0,
  delay: 0,
  elapsed: -1,
  clock: 'timeline' as 'timeline' | 'frames',
  ease: () => easing.cubicOut,
  ready: true,
  restartKey: () => undefined as string | undefined,
});

/** Shader uniform that mirrors a world transition for its materials. */
export const TransitionUniform = trait(() => null! as UniformNode<'float', number>);
