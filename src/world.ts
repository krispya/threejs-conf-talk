import { Bounds } from './camera/traits.js';
import { Time } from './time/traits.js';
import { createWorld } from 'koota';

export const world = createWorld(Time, Bounds);
