import { createActions } from 'koota';
import { titleActions } from './title/actions.js';
import { initiativeActions } from './initiative/actions.js';
import { charterActions } from './charter/actions.js';
import { cameraActions } from './camera/actions.js';
import { letterActions } from './letter/actions.js';
import { profileActions } from './profile/actions.js';
import { packageActions } from './package/actions.js';
import { timelineActions } from './timeline/actions.js';

export const actions = createActions((world) => ({
  ...titleActions(world),
  ...initiativeActions(world),
  ...charterActions(world),
  ...cameraActions(world),
  ...letterActions(world),
  ...profileActions(world),
  ...packageActions(world),
  ...timelineActions(world),
}));
