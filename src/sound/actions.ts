import { createActions } from 'koota';
import { Sound, SoundView, type OneShot, type SoundDraw } from './traits.js';

export const soundActions = createActions((world) => ({
  /** Attach the mixer. Whatever was cued while no mixer listened is dropped rather than played late. */
  mountSoundView: (view: SoundDraw) => {
    world.get(Sound)!.queue.count = 0;
    world.add(SoundView(view));
  },
  unmountSoundView: () => {
    world.remove(SoundView);
  },
  /** The mixer has played this frame's cues. */
  clearSoundCues: () => {
    world.get(Sound)!.queue.count = 0;
  },
  toggleSound: () => {
    world.set(Sound, { muted: !world.get(Sound)!.muted });
  },
  /** Queue a voice for the mixer. A frame holds a bounded number of cues, and any past that are dropped. */
  cueSound: (voice: OneShot, pan: number, rate: number, gain: number, delay = 0, stage = false) => {
    const queue = world.get(Sound)!.queue;
    if (queue.count === queue.cues.length) return;
    const cue = queue.cues[queue.count++]!;
    cue.voice = voice;
    cue.pan = pan;
    cue.rate = rate;
    cue.gain = gain;
    cue.delay = delay;
    cue.stage = stage;
  },
}));
