import { createWorld } from 'koota';
import { Bounds, Time } from './traits/index.js';

export const world = createWorld(Time, Bounds);
