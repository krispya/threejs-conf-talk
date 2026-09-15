import { Time } from './traits.js';
import type { World } from 'koota';

export function updateTime(world: World, delta: number, elapsed: number) {
  world.set(Time, { delta: Math.min(delta, 1 / 30), elapsed });
}
