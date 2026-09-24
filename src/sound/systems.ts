import type { Entity, World } from 'koota';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { Showreel } from '../background/traits.js';
import { Bounds, Camera, TargetPosition } from '../camera/traits.js';
import { DownloadCounter, FeatureChips, Package, PackagePresence } from '../package/traits.js';
import { Profile, ProfilePresence } from '../profile/traits.js';
import { Time } from '../time/traits.js';
import {
  ActiveScreen,
  NextScreen,
  PreviousScreen,
  Screen,
  ScreenTransition,
  Timeline,
} from '../timeline/traits.js';
import { Position, Size } from '../traits.js';
import { soundActions } from './actions.js';
import { Sound, SoundView, type OneShot } from './traits.js';

/**
 * The score's chords in semitones from the pad's C3, all from C major so the pentatonic notes over them agree. Each
 * act has one: an open A minor for the opening, and G, D, and A stacked in fourths under the stars. Through the pastel world the chord follows the story instead, moving at each beat and holding
 * until the next: home among the packages, a warm lift for the letters, the people, a look back through history,
 * the search for work, hope as the community gathers, tension as the robot arrives, the team, the principles, the
 * charter's anticipation, and resolution with its announcement.
 */
const CHORDS: Readonly<Record<string, readonly number[]>> = {
  solid: [-3, 4, 7],
  pastel: [0, 7, 14],
  stars: [-5, 2, 9],
  packages: [0, 7, 14],
  letters: [5, 12, 16],
  profiles: [-3, 4, 12],
  'history-logos': [-8, -1, 7],
  work: [2, 9, 12],
  'paul-community': [-5, 2, 11],
  'community-robot': [-3, 0, 5],
  maintainers: [5, 9, 14],
  principles: [2, 7, 12],
  charter: [7, 11, 14],
  'charter-announcement': [0, 4, 12],
};

/**
 * Through the stone portal the score changes completely and stays changed to the last slide: a glass pad in place
 * of the choir, music box rolls in place of single notes, and a new key a minor third up, where every note
 * transposes. Its chords move with the initiatives, from home, through a lift, the people, a question, and a turn,
 * to a bright close, and settle home with a ninth as the talk ends.
 */
const GLADE: Readonly<Record<string, readonly number[]>> = {
  initiatives: [0, 7, 16],
  'initiative-glyph': [5, 9, 16],
  'initiative-design-system': [-3, 4, 11],
  'initiative-math': [2, 9, 17],
  'initiative-experimental': [-5, 2, 11],
  'initiative-games': [0, 4, 11],
  closing: [0, 7, 14],
};

/** Voices with a note, which the score's key transposes. */
const MUSICAL = new Set<OneShot>(['doo', 'chime', 'pluck', 'bloop', 'swell']);

/**
 * The chord a screen plays: its act's, or through the pastel world and the glade the last story beat at or before
 * it.
 */
function beatOf(screen: Entity | undefined) {
  for (let at = screen; at; at = at.targetFor(PreviousScreen)) {
    const { id, background, initiativesVisible } = at.get(Screen)!;
    if (id in CHORDS || id in GLADE) return id;
    if (background !== 'pastel' && !initiativesVisible) return background;
  }
  return 'pastel';
}

function chordOf(beat: string) {
  return CHORDS[beat] ?? GLADE[beat] ?? CHORDS.pastel!;
}

/**
 * Notes up the same scale: a bubble's by its package, a chip's by its place in the stack, and the harp of bells
 * into the title's portal.
 */
const BUBBLES = [0, 2, 4, 7, 9, 12];
export const CHIPS = [0, 2, 4, 7, 9];
const GLISSANDO = [-12, -10, -8, -5, -3, 0, 2, 4, 7];

/** What a screen shows. More of these arriving than leaving is things coming in, and the reverse is things going. */
const SHOWN = [
  'titleVisible',
  'lettersVisible',
  'packagesVisible',
  'packageDownloadsVisible',
  'packageFeaturesVisible',
  'packageMaintainersVisible',
  'codeComparisonVisible',
  'robotVisible',
  'communityRobotVisible',
  'teamVisible',
  'profilesVisible',
  'greetingVisible',
  'showreelVisible',
  'principlesVisible',
  'charterVisible',
  'storyConnectionsVisible',
  'announcementVisible',
  'initiativesVisible',
  'benchmarkVisible',
  'closingVisible',
] as const;

/** Parts that slide in and out as cards and sheets, which their views give a swoosh as they move. */
const SLIDES = ['codeComparisonVisible', 'charterVisible', 'announcementVisible'] as const;

/** How a screen arranges what it already shows, each with the part that must be showing for it to be seen. */
const ARRANGED = [
  ['packageLayout', 'packagesVisible'],
  ['packageSizing', 'packagesVisible'],
  ['focusedProfile', 'profilesVisible'],
  ['historyPages', 'profilesVisible'],
  ['charterHighlight', 'charterVisible'],
  ['charterFocus', 'charterVisible'],
  ['initiative', 'initiativesVisible'],
  ['benchmarkVariant', 'benchmarkVisible'],
  ['showreelFocus', 'showreelVisible'],
  ['principlesLogo', 'principlesVisible'],
  ['robotFriendly', 'communityRobotVisible'],
] as const;

/** How much of each voice goes to the hall and to the void. The score's sparse notes hang in the void's echo. */
const MIX: Readonly<Record<OneShot, readonly [hall: number, expanse: number]>> = {
  doo: [0.4, 0.5],
  chime: [0.7, 0.4],
  whoosh: [0.4, 0],
  gulp: [0.5, 0],
  boom: [0.8, 0],
  bloop: [0.35, 0.25],
  tick: [0.1, 0],
  braam: [0.8, 0.2],
  surge: [0.4, 0],
  glint: [0.5, 0.6],
  warp: [0.3, 0],
  laser: [0.35, 0.3],
  glitch: [0.3, 0.5],
  flight: [0.5, 0.3],
  breach: [0.4, 0.2],
  sparkle: [0.2, 1],
  pluck: [0.4, 0.35],
  swell: [0.6, 0.3],
  drop: [0.2, 0],
  rustle: [0.15, 0],
  veil: [0.45, 0.1],
  fall: [0.35, 0],
};

export function pitch(semitones: number) {
  return 2 ** (semitones / 12);
}

/** A playback rate within about two semitones either side of `rate`, so a repeated voice never sounds the same. */
export function varied(rate: number) {
  return rate * (0.88 + Math.random() * 0.24);
}

/**
 * Listen to the talk and cue a sound for each moment: a gesture that moves with each screen's transition, the
 * bubbles floating in and their counts ticking up, the portals opening and letting the talk through, and the
 * score's sparse notes. Publishes how far a portal draws the talk in, and the chord the score plays. Runs
 * last in the simulation, so everything this frame changed is heard.
 */
export function listenForSounds(world: World) {
  const sound = world.get(Sound)!;
  const heard = sound.heard;
  const now = world.get(Time)!.elapsed;
  const cue = soundActions(world).cueSound;
  const timeline = world.queryFirst(Timeline);
  const screen = timeline?.targetFor(ActiveScreen);
  const data = screen?.get(Screen);
  const timing = timeline?.get(Timeline);
  if (!screen || !data || !timing) return;
  const elapsed = now - timing.startedAt;
  const { width } = world.get(Bounds)!;
  const across = (x: number) => clamp(x / Math.max(1, width / 2), -1, 1) * 0.7;

  let beat = sound.beat;
  if (screen !== heard.screen) {
    const left = heard.screen?.isAlive() ? heard.screen.get(Screen) : undefined;
    const reached = beatOf(screen);
    const transition = screen.get(ScreenTransition)!;
    // Stepping back or jumping stays quiet
    const forward = heard.screen?.targetFor(NextScreen) === screen ? left : undefined;
    if (forward?.warpVisible || forward?.initiativePortalVisible) {
      // A portal lets the talk through in sprays of sparkle and a high bell that glitter on in the void. Past the
      // stone portal's membrane they wait for the far side to begin opening up
      const opened = forward.initiativePortalVisible ? 0.3 : 0;
      cue('sparkle', -0.5, 1, 0.15, opened, true);
      cue('sparkle', 0.5, 1, 0.15, opened + 0.06, true);
      cue('chime', 0, pitch(12), 0.085, opened, true);
    } else if (
      forward &&
      !data.warpVisible &&
      !data.initiativePortalVisible &&
      !data.principlesVisible &&
      // Cards and sheets that slide swoosh from their own views as they move
      !SLIDES.some((key) => data[key] !== forward[key]) &&
      data.historyPages === forward.historyPages
    ) {
      // Each step forward moves with a gesture of its own, on the notes of the act's chord and turning through its
      // variations so no two in a row sound alike: a bell swelling in as the camera travels and landing as it
      // arrives, or a deep whoosh for the longest flights, a rising arpeggio, sparkle, or pair as things come in, a
      // falling pair or settling air as they go, and a strum, bell, or tick-tock as the screen rearranges.
      const camera = world.queryFirst(Camera, Position, TargetPosition);
      const from = camera?.get(Position);
      const to = camera?.get(TargetPosition);
      const travel = from && to ? Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) : 0;
      const grown =
        data.packagesVisible || forward.packagesVisible
          ? Math.sign(data.packageNames.length - forward.packageNames.length)
          : 0;
      const arriving = SHOWN.filter((key) => data[key] && !forward[key]).length + Math.max(0, grown);
      const leaving = SHOWN.filter((key) => !data[key] && forward[key]).length + Math.max(0, -grown);
      const moving = transition.duration - transition.cameraDelay;
      const chord = chordOf(reached)
        .map((note) => ((note % 12) + 12) % 12)
        .sort((a, b) => a - b);
      const turn = () => heard.gestures++ % 3;
      const reveal = transition.revealDelay;
      const played = (
        voice: OneShot,
        notes: readonly number[],
        level: number,
        spacing: number,
        at = 0
      ) =>
        notes.forEach((note, step) =>
          cue(
            voice,
            lerp(-0.3, 0.3, step / Math.max(1, notes.length - 1)),
            pitch(note),
            level,
            at + step * spacing
          )
        );
      if (travel > 60)
        cue('whoosh', 0, clamp(1.2 / Math.max(0.1, moving), 0.5, 1.2), 0.06, transition.cameraDelay);
      else if (travel > 5)
        cue(
          'swell',
          0,
          pitch(chord[0]! - 12),
          0.06,
          transition.cameraDelay + Math.max(0, moving - 1.4)
        );
      else if (arriving > leaving) {
        const variant = turn();
        if (variant === 0) played('pluck', chord, 0.1, 0.09, reveal);
        else if (variant === 1) cue('sparkle', 0, 1, 0.1 * 0.5, reveal);
        else played('doo', [chord[0]!, chord[2]!], 0.1, 0.12, reveal);
      } else if (leaving > arriving) {
        const variant = turn();
        if (variant === 0) played('pluck', [chord[2]! - 12, chord[0]! - 12], 0.05, 0.11);
        else if (variant === 1)
          cue('fall', 0, clamp(1.2 / Math.max(0.1, transition.duration), 0.7, 1.4), 0.05);
        else played('doo', [chord[1]!, chord[0]! - 12], 0.05, 0.14);
      } else if (
        grown !== 0 ||
        ARRANGED.some(([key, shown]) => (data[shown] || forward[shown]) && data[key] !== forward[key])
      ) {
        const variant = turn();
        if (variant === 0) played('pluck', [...chord, chord[0]! + 12], 0.07, 0.04);
        else if (variant === 1) cue('chime', 0, pitch(chord[0]! - 12), 0.07);
        else played('tick', [-4, -9], 0.07, 0.12);
      }
    }
    // A new story beat in the pastel world rings a low bell on its chord's root as the score moves to it
    if (forward && reached !== beat && data.background === 'pastel' && !forward.warpVisible)
      cue('chime', 0, pitch(chordOf(reached)[0]! - 24), 0.05);
    beat = reached;
    // The stone portal changes its footage in a magical glitch
    if (data.initiativesVisible && left?.initiativesVisible && data.initiative !== left.initiative)
      cue('glitch', 0.3, 1, 0.12);
    heard.screen = screen;
    heard.elapsed = 0;
  }
  const passed = (at: number) => heard.elapsed < at && elapsed >= at;
  // A harp of bells climbing into a portal's crossing
  const harp = () => {
    for (const [step, note] of GLISSANDO.entries())
      cue(
        'chime',
        lerp(-0.6, 0.6, step / (GLISSANDO.length - 1)),
        pitch(note),
        0.055,
        step * 0.075,
        true
      );
  };
  const collapsing =
    !data.announcementVisible && !!screen.targetFor(PreviousScreen)?.get(Screen)?.announcementVisible;

  let draw = 0;
  if (data.warpVisible) {
    // The title's portal opens on a low bell that hangs in the void, and a harp of bells climbs into the crossing
    draw = clamp(elapsed / timing.duration, 0, 1) ** 1.5;
    if (passed(1.15)) cue('chime', 0, pitch(-12), 0.21, 0, true);
    if (passed(timing.duration - 0.7)) harp();
  } else if (data.initiativePortalVisible) {
    // The stone portal opens on a bell a fourth below the title's, tolls its warning as it flares, and a harp of
    // bells climbs through the fall into the crossing
    const delay = screen.get(ScreenTransition)!.cameraDelay;
    const fall = clamp((elapsed - delay) / Math.max(0.001, timing.duration - delay), 0, 1) ** 2;
    draw = lerp(0.3 * clamp(elapsed / delay, 0, 1), 1, fall);
    if (passed(0.8)) cue('chime', 0, pitch(-17), 0.21, 0, true);
    if (passed(delay - 0.5)) cue('chime', 0, pitch(-24), 0.42, 0, true);
    if (passed(delay)) cue('flight', 0, 1.15, 0.45, 0, true);
    // The harp lands its last bell just as the camera enters, about 0.17 seconds before the screen ends, and air
    // rushes in to break through the membrane with a thump there
    if (passed(timing.duration - 0.8)) harp();
    if (passed(timing.duration - 0.57)) cue('breach', 0, 1, 0.5, 0, true);
  } else if (collapsing) {
    // The black hole opens with a deep gulp and gulps again at each shard it swallows, lower as it grows, while it
    // draws the talk in and bends everything, the music too. A reversed swell rises into its pop, which silences
    // the music: a boom, a vast horn, and embers sparkling in the void, then the camera rushes out to the stars
    if (elapsed < 2.26) draw = clamp(elapsed / 2.26, 0, 1) ** 1.3;
    if (passed(0.05)) cue('gulp', 0, 0.55, 0.7, 0, true);
    for (const [meal, at] of [1, 1.3, 1.6, 1.9].entries())
      if (passed(at)) cue('gulp', lerp(-0.4, 0.4, meal / 3), 1.3 - meal * 0.15, 0.45, 0, true);
    if (passed(0.26)) cue('swell', 0, 0.7, 0.2, 0, true);
    if (passed(2.26)) {
      cue('boom', 0, 1, 1, 0, true);
      cue('braam', 0, 0.7, 0.5, 0, true);
      cue('sparkle', -0.5, 1, 0.12, 0.05, true);
      cue('sparkle', 0.5, 1, 0.12, 0.12, true);
    }
    if (passed(2.4)) cue('flight', 0, 1, 0.5, 0, true);
  }
  heard.elapsed = elapsed;

  // Each bubble floats in on its own note, lower the larger it is, so a staggered group plays a rising run
  for (const entity of world.query(Package, PackagePresence, Position, Size)) {
    const presence = entity.get(PackagePresence)!;
    const last = heard.presence.get(entity) ?? 0;
    heard.presence.set(entity, presence.value);
    if (presence.target !== 1 || last > 0.001 || presence.value <= 0.001) continue;
    const octave = clamp(Math.log2(entity.get(Size)!.radius), 0, 1);
    const note = BUBBLES[entity.get(Package)!.index % BUBBLES.length]!;
    cue('bloop', across(entity.get(Position)!.x), pitch(note - 12 * octave), 0.14);
  }

  // The chips beside a sphere land with soft mallet notes, a step up the scale each
  for (const entity of world.query(FeatureChips, Position)) {
    const { items } = entity.get(FeatureChips)!;
    const last = heard.chips.get(entity) ?? [];
    for (const [index, item] of items.entries()) {
      if (item.target === 1 && (last[index] ?? 0) <= 0.001 && item.value > 0.001)
        cue('doo', across(entity.get(Position)!.x) + 0.2, pitch(CHIPS[index % CHIPS.length]!), 0.09);
      last[index] = item.value;
    }
    heard.chips.set(entity, last);
  }

  // Portraits arrive with tiny bells scattered over a moment, so a crowd glitters in rather than landing at once
  let arrivals = 0;
  for (const entity of world.query(Profile, ProfilePresence, Position)) {
    const presence = entity.get(ProfilePresence)!;
    const last = heard.portraits.get(entity) ?? 0;
    heard.portraits.set(entity, presence.value);
    if (presence.target !== 1 || last > 0.001 || presence.value <= 0.001 || arrivals++ >= 12)
      continue;
    const note = BUBBLES[Math.floor(Math.random() * BUBBLES.length)]!;
    cue('chime', across(entity.get(Position)!.x), pitch(note - 12), 0.03, Math.random() * 0.4);
  }

  // Each download ticker ticks at even steps of its count, quick at first and slower as it settles, climbing a little
  // as it goes, and rings as it lands
  for (const entity of world.query(Package, DownloadCounter, Position)) {
    const counter = entity.get(DownloadCounter)!;
    const last = heard.counted.get(entity) ?? -1;
    if (counter.value === last) continue;
    heard.counted.set(entity, counter.value);
    const { downloads, index } = entity.get(Package)!;
    if (!counter.visible || counter.value < 0 || downloads <= 0) continue;
    const pan = across(entity.get(Position)!.x);
    const counting = last >= 0 && last < counter.value;
    const step = Math.floor((counter.value / downloads) * 24);
    if (counting && counter.value === downloads)
      cue('chime', pan, pitch(BUBBLES[index % BUBBLES.length]! - 12), 0.06);
    else if (step > (counting ? Math.floor((last / downloads) * 24) : -1))
      cue('tick', pan, pitch((counter.value / downloads) * 5), 0.05);
  }

  // As the showreel pulls back from one clip to the whole wall of community work, the sound opens with it. Bells
  // scatter outward and upward, each as its share of the wall comes into view, so they crowd the fast middle of the
  // pull. A bell played backwards swells in beneath and lands on a low chord as the whole wall arrives, and the
  // score spreads wider into a larger hall
  const reel = world.queryFirst(Showreel)?.get(Showreel)?.motion;
  const wall = !!reel?.visible && reel.focus < 0;
  const opening = wall ? clamp((now - reel.zoomAt - reel.zoomDelay) / reel.zoomDuration, 0, 1) : 0;
  const root = chordOf(beat)[0]!;
  if (heard.opening === 0 && opening > 0) {
    const notes = chordOf(beat).map((note) => ((note % 12) + 12) % 12);
    for (let bell = 0; bell < 20; bell++) {
      const share = (bell + 0.5) / 20;
      // When the pull's quintic ease reaches this share of the wall
      const at =
        reel!.zoomDuration * (share < 0.5 ? (share / 16) ** 0.2 : 1 - (2 * (1 - share)) ** 0.2 / 2);
      // Rising from an octave below the bell into its own octave as the wall opens out
      const note = notes[Math.floor(Math.random() * notes.length)]! + 12 * Math.floor(share * 2 - 1);
      cue(
        'chime',
        (bell % 2 ? 1 : -1) * lerp(0.1, 0.9, share),
        pitch(note),
        lerp(0.03, 0.05, share),
        at
      );
    }
    // The swell sits an octave down unless it would then be too slow to land on the arrival
    const swell = pitch(root - 12) >= 1.4 / reel!.zoomDuration ? pitch(root - 12) : pitch(root);
    cue('swell', 0, swell, 0.15, Math.max(0, reel!.zoomDuration - 1.4 / swell));
  }
  if (heard.opening < 1 && opening === 1) {
    cue('chime', -0.3, pitch(root - 24), 0.08);
    cue('chime', 0.3, pitch(root - 17), 0.06);
  }
  heard.opening = opening;

  // Now and then the score plays one note of its chord, a soft mallet or a bell far back in the void's echo, and in
  // the glade a music box rolls up it instead. It rests while a portal draws the talk in
  const glade = beat in GLADE;
  if (now >= heard.nextNote) {
    if (draw === 0) {
      const chord = chordOf(beat);
      if (glade) {
        const notes = chord.map((note) => ((note % 12) + 12) % 12).sort((a, b) => a - b);
        for (const [step, note] of [...notes, notes[0]! + 12, notes[1]! + 12].entries())
          cue('pluck', lerp(-0.4, 0.4, step / 4), pitch(note), 0.07, step * 0.16);
      } else {
        const note =
          (((chord[Math.floor(Math.random() * chord.length)]! % 12) + 12) % 12) -
          (Math.random() < 0.5 ? 12 : 0);
        const bell = Math.random() < 0.3;
        cue(
          bell ? 'chime' : 'doo',
          Math.random() * 1.2 - 0.6,
          pitch(bell ? note - 12 : note),
          bell ? 0.08 : 0.2
        );
      }
    }
    heard.nextNote = now + (glade ? 4 + Math.random() * 4 : 5 + Math.random() * 9);
  }

  // The camera enters the stone portal as it passes through its plane, and comes out on the far side as the
  // initiatives begin
  const entered =
    !!data.initiativePortalVisible &&
    (world.queryFirst(Camera, Position)?.get(Position)?.z ?? 1) <= 0;
  const emerging =
    !!data.initiativesVisible &&
    !!screen.targetFor(PreviousScreen)?.get(Screen)?.initiativePortalVisible;
  world.set(Sound, {
    beat,
    key: glade ? 3 : 0,
    draw,
    rise: draw > 0 ? draw : sound.rise,
    // The title's drones climb a fifth. The stone portal's climb past an octave and a half, faster and faster, as
    // if its energy were immense, and are pulled an octave further as the membrane takes them
    climb: data.warpVisible
      ? 7 * draw ** 1.5
      : data.initiativePortalVisible
        ? 24 * draw ** 2.5 + (entered ? 12 : 0)
        : sound.climb,
    // Inside the membrane at once, then the far side opens out of it over a second and a half
    through: entered ? 1 : emerging ? (1 - clamp(elapsed / 1.6, 0, 1)) ** 2 : 0,
    warp: collapsing ? draw : 0,
    scope: wall ? easing.quintInOut(opening) : 0,
    // The music cuts out as the black hole pops and stays silent through the journey to the glade, and it fades
    // away as the talk ends
    hush:
      (collapsing && elapsed >= 2.26) || data.initiativePortalVisible
        ? 0.02
        : data.closingVisible
          ? 2.5
          : 0,
  });
}

/**
 * Play this frame's cues through the mounted mixer, and set its loops from the talk. As a portal draws the talk in,
 * the score ducks, sinks in pitch, dulls, and crushes while the portal's drones climb, and it all comes back clean
 * on the far side.
 */
export function playSounds(world: World) {
  const view = world.get(SoundView);
  if (!view) return;
  const sound = world.get(Sound)!;
  const { queue, draw, rise } = sound;
  const { context, pad } = view;
  const now = context.currentTime;

  // Audio waits for a gesture. A suspended context would hold these and play them all at once when it resumed
  if (context.state === 'running') {
    for (let index = 0; index < queue.count; index++) {
      const cue = queue.cues[index]!;
      const [hall, expanse] = MIX[cue.voice];
      const source = context.createBufferSource();
      source.buffer = view.samples[cue.voice];
      source.playbackRate.value =
        cue.rate * (MUSICAL.has(cue.voice) ? pitch(sound.key) : 1) * (cue.stage ? 1 : 1 - 0.3 * draw);
      const level = context.createGain();
      level.gain.value = cue.gain;
      const pan = context.createStereoPanner();
      pan.pan.value = cue.pan;
      source
        .connect(level)
        .connect(pan)
        .connect(cue.stage ? view.stage : view.score);
      if (hall) pan.connect(send(context, hall, view.hall));
      if (expanse) pan.connect(send(context, expanse, view.expanse));
      source.start(now + cue.delay);
    }
  }
  soundActions(world).clearSoundCues();

  // A new chord starts on a silent layer of its world's pad and fades in over the last
  const chord = chordOf(sound.beat);
  const glade = sound.beat in GLADE;
  if (pad.beat !== sound.beat) {
    const first = glade ? 2 : 0;
    pad.active = pad.active === first ? first + 1 : first;
    pad.beat = sound.beat;
    pad.layers[pad.active]!.forEach(({ source }, voice) => {
      source.playbackRate.cancelScheduledValues(now);
      source.playbackRate.setValueAtTime(pitch(chord[voice]! + sound.key), now);
    });
  }
  // The showreel's opening spreads the pad wider, lifts it, and makes the hall larger, and the far side of a
  // portal's membrane opens up washed in the hall, drying as it clears
  view.wet.gain.setTargetAtTime(0.7 * (1 + 0.8 * sound.scope) * (1 + 1.5 * sound.through), now, 0.3);
  pad.layers.forEach((layer, index) => {
    for (const [voice, { source, level, pan }] of layer.entries()) {
      pan.pan.setTargetAtTime((voice - 1) * 0.45 * (1 + sound.scope), now, 0.3);
      level.gain.setTargetAtTime(
        index === pad.active ? (glade ? 0.05 : 0.045) * (1 + 0.6 * sound.scope) : 0,
        now,
        1.5
      );
      if (index === pad.active)
        source.playbackRate.setTargetAtTime(
          pitch(chord[voice]! + sound.key) * (1 - 0.3 * draw),
          now,
          0.1
        );
    }
  });

  // The portal's drones climb together, faster the nearer the crossing, and its overtone an octave above joins as
  // it goes, both louder the further past a fifth they reach. Past the title's crossing they hold where they reached
  // as they fade, and the stone portal's are swept up and away as the membrane takes them.
  const { climb, through } = sound;
  const energy = 1 + Math.max(0, climb - 7) / 20;
  if (through > 0)
    for (const { level } of [view.drone, view.overtone]) level.gain.setTargetAtTime(0, now, 0.1);
  else {
    view.drone.level.gain.setTargetAtTime(
      0.5 * Math.min(1, draw * 3) * (0.3 + 0.7 * draw) * energy,
      now,
      0.2
    );
    view.overtone.level.gain.setTargetAtTime(0.3 * draw * rise * energy, now, 0.2);
  }
  view.drone.source.playbackRate.setTargetAtTime(pitch(climb), now, through > 0 ? 0.08 : 0.2);
  view.overtone.source.playbackRate.setTargetAtTime(pitch(12 + climb), now, through > 0 ? 0.08 : 0.2);
  // Passing through the membrane muffles the whole mix down to its lows, and the far side opens up out of it
  const open = context.sampleRate / 2;
  view.membrane.frequency.setTargetAtTime(open * (280 / open) ** through, now, 0.03);
  // A portal ducks the music as it draws the talk in, a black hole only a little so its bending is heard, and the
  // music comes back gently once it has been silenced
  const heard = view.score.gain.value;
  const music = sound.hush > 0 ? 0 : 1 - (sound.warp > 0 ? 0.2 : 0.6) * draw;
  view.score.gain.setTargetAtTime(
    music,
    now,
    sound.hush > 0 ? sound.hush : music > heard + 0.05 ? 0.8 : 0.05
  );
  // A black hole sinks everything like a tape slowing and wobbles it as the pull warps it, drives the mix into
  // distortion with the master lowered to match, and lets go at once as it pops
  if (sound.warp > 0) {
    view.warp.delayTime.setTargetAtTime(0.45 * sound.warp ** 2, now, 0.05);
    view.wobble.gain.setTargetAtTime(0.004 * sound.warp ** 1.5, now, 0.05);
  } else if (view.warp.delayTime.value > 0) {
    view.warp.delayTime.cancelScheduledValues(now);
    view.warp.delayTime.setValueAtTime(0, now);
    view.wobble.gain.cancelScheduledValues(now);
    view.wobble.gain.setValueAtTime(0, now);
  }
  view.ceiling.gain.setTargetAtTime(0.5 * (1 + 2 * sound.warp), now, 0.05);
  view.stage.gain.setTargetAtTime(1.4, now, 0.05);
  view.tone.frequency.setTargetAtTime(lerp(16_000, 700, draw ** 0.8), now, 0.03);
  view.crushed.gain.setTargetAtTime(0.6 * draw, now, 0.03);
  view.clean.gain.setTargetAtTime(1 - 0.6 * draw, now, 0.03);
  view.master.gain.setTargetAtTime(sound.muted ? 0 : 0.7 / (1 + 2 * sound.warp), now, 0.05);
}

/** A gain of `amount` into one of the mix's spaces. */
export function send(context: BaseAudioContext, amount: number, into: AudioNode) {
  const level = context.createGain();
  level.gain.value = amount;
  level.connect(into);
  return level;
}
