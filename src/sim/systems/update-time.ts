import type { World } from 'koota';
import { Time } from '../traits/index.js';

const MAX_DELTA = 1 / 30;

export function updateTime(world: World, delta: number, elapsed: number) {
  world.set(Time, { delta: Math.min(delta, MAX_DELTA), elapsed });
}
