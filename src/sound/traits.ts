import { trait, type Entity } from 'koota';

/** The baked voices played once per cue. */
export type OneShot =
  | 'doo'
  | 'chime'
  | 'whoosh'
  | 'gulp'
  | 'boom'
  | 'bloop'
  | 'tick'
  | 'braam'
  | 'surge'
  | 'glint'
  | 'warp'
  | 'laser'
  | 'glitch'
  | 'flight'
  | 'breach'
  | 'sparkle'
  | 'pluck'
  | 'swell'
  | 'drop'
  | 'rustle'
  | 'veil'
  | 'fall';

/**
 * One sound: its voice, its place from -1 left to 1 right, its playback rate and level, its delay in seconds, and
 * whether it plays on the stage, as the portal's own voices do, rather than in the score a portal draws in.
 */
export interface SoundCue {
  voice: OneShot;
  pan: number;
  rate: number;
  gain: number;
  delay: number;
  stage: boolean;
}

/** What the listener last heard, so each change in the talk sounds once. */
export interface Heard {
  screen: Entity | undefined;
  /** Seconds into the screen last frame, so a moment inside a transition cues once as it passes. */
  elapsed: number;
  /** When the score may next play one of its sparse notes, on the talk's clock. */
  nextNote: number;
  /** Each package's presence last frame, so a bubble floats in once. */
  presence: Map<Entity, number>;
  /** Each download ticker's shown count last frame, so each step of it ticks once. */
  counted: Map<Entity, number>;
  /** Each feature chip's entrance last frame, by package, so a chip lands once. */
  chips: Map<Entity, number[]>;
  /** Each portrait's presence last frame, so a portrait arrives once. */
  portraits: Map<Entity, number>;
  /** How many transition gestures have played, so each kind turns through its variations. */
  gestures: number;
  /** How far the showreel's pull back to its whole wall had come last frame. */
  opening: number;
}

export const Sound = trait({
  muted: false,
  /** Which chord the score plays: the act's, by the background it shows, or the last story beat the talk reached. */
  beat: 'solid',
  /** Semitones the score's notes sit above C, so a new world can change key. */
  key: 0,
  /** 0..1: how far a black hole bends the whole mix, sinking and wobbling it as it pulls. */
  warp: 0,
  /**
   * While above zero the music falls silent with this time constant in seconds: at once as the black hole pops,
   * and slowly as the talk ends.
   */
  hush: 0,
  /** 0..1: how far the showreel has opened out to its whole wall, which widens the score's space with it. */
  scope: 0,
  /** 0..1: how far a portal draws the talk in. The score ducks, sinks, dulls, and crushes as the drones climb. */
  draw: 0,
  /** How far the drones have climbed. They hold it past the crossing so they fade where they reached. */
  rise: 0,
  /** Semitones the portal's drones have climbed, held past the crossing like `rise`. */
  climb: 0,
  /**
   * 0..1: how deep the talk is in the stone portal's membrane. Entering it muffles everything at once, and the far
   * side opens up out of it.
   */
  through: 0,
  /** This frame's cues, a fixed buffer and count that the mounted mixer drains. */
  queue: () => ({
    count: 0,
    cues: Array.from({ length: 32 }, (): SoundCue => ({
      voice: 'doo',
      pan: 0,
      rate: 1,
      gain: 0,
      delay: 0,
      stage: false,
    })),
  }),
  heard: (): Heard => ({
    screen: undefined,
    elapsed: 0,
    nextNote: 0,
    presence: new Map(),
    counted: new Map(),
    chips: new Map(),
    portraits: new Map(),
    gestures: 0,
    opening: 0,
  }),
});

/** A continuous voice: its looping source, and the level and place the talk sets on it. */
export interface LoopDraw {
  source: AudioBufferSourceNode;
  level: GainNode;
  pan: StereoPannerNode;
}

/**
 * The mounted mixer. The score carries the soundtrack and the flight's cabin, and the stage carries the portal's
 * own voices. A portal ducks the score and bends it through `clean`, `crushed`, and `tone`, while the stage stays
 * clear. Voices reach the hall and the void through their sends.
 */
export interface SoundDraw {
  context: AudioContext;
  samples: Readonly<Record<OneShot | 'pad' | 'glade' | 'drone' | 'cabin', AudioBuffer>>;
  score: GainNode;
  stage: GainNode;
  hall: AudioNode;
  /** The hall's return, which the showreel's opening makes larger. */
  wet: GainNode;
  expanse: AudioNode;
  clean: GainNode;
  crushed: GainNode;
  tone: BiquadFilterNode;
  master: GainNode;
  /** The delay line a black hole stretches to sink the whole mix, and the depth of the wobble on it. */
  warp: DelayNode;
  wobble: GainNode;
  /** How hard the mix drives the soft clip, which a black hole pushes into distortion. */
  ceiling: GainNode;
  /** A low-pass over the whole mix that closes as the talk passes through a portal's membrane. At rest it is open. */
  membrane: BiquadFilterNode;
  /**
   * Layers of three pad voices, two of the choir and then two of the glade's glass pad, so a new chord fades in
   * over the last.
   */
  pad: { layers: readonly (readonly LoopDraw[])[]; active: number; beat: string };
  drone: LoopDraw;
  /** The drone an octave up, which joins it as it climbs. */
  overtone: LoopDraw;
}

export const SoundView = trait((): SoundDraw | undefined => undefined);
