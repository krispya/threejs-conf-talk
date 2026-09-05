import { createWorld } from 'koota';
import { Bounds, Time, Timeline } from './traits/index.js';

export const world = createWorld(Time, Bounds, Timeline);
