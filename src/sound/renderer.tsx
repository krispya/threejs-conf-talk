import { useWorld } from 'koota/react';
import { useEffect } from 'react';
import { soundActions } from './actions.js';
import { loadSamples } from './samples.js';
import { send } from './systems.js';
import type { LoopDraw, SoundDraw } from './traits.js';

/**
 * The talk's sound: console-era samples through a modern mix. Browsers hold audio until a gesture, so the first
 * press or key in the page starts it, and nothing cued before then plays late.
 */
export function SoundRenderer() {
  const world = useWorld();

  useEffect(() => {
    let mounted = true;
    let viewMounted = false;
    const context = new AudioContext({ latencyHint: 'interactive' });
    const unlock = () => {
      if (context.state === 'suspended') void context.resume();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    void loadSamples().then((samples) => {
      if (!mounted) return;
      soundActions(world).mountSoundView(mix(context, samples));
      viewMounted = true;
    });
    return () => {
      mounted = false;
      if (viewMounted) soundActions(world).unmountSoundView();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      void context.close();
    };
  }, [world]);

  return null;
}

/**
 * The mix. The score ducks and bends as a portal draws it in, splitting between a plain path and a four-bit crush
 * before a low-pass closes on it, and a compressor glues it. The stage carries the portal's own voices past the bend
 * and the compressor, so its crossings keep their punch, and a soft clip rounds the loudest of them. A hall in the
 * manner of the PlayStation's reverb and a void with its own echo return into the score, so their tails are drawn in
 * too.
 */
function mix(context: AudioContext, samples: SoundDraw['samples']): SoundDraw {
  const score = context.createGain();
  const clean = context.createGain();
  const crushed = context.createGain();
  crushed.gain.value = 0;
  const crusher = context.createWaveShaper();
  // Seventeen levels, about four bits, with no oversampling so the steps alias as the old hardware's did
  crusher.curve = Float32Array.from(
    { length: 1024 },
    (_, index) => Math.round(((index / 1023) * 2 - 1) * 8) / 8
  );
  crusher.oversample = 'none';
  const tone = context.createBiquadFilter();
  tone.frequency.value = 16_000;
  tone.Q.value = 1;
  score.connect(clean).connect(tone);
  score.connect(crusher).connect(crushed).connect(tone);
  const stage = context.createGain();
  // The compressor adds its own makeup gain of about 7 dB, so the score is trimmed by as much on the way in
  const trim = context.createGain();
  trim.gain.value = 0.44;
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 10;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.25;
  const master = context.createGain();
  master.gain.value = 0;
  // The clip's curve spans twice full scale, so it stays level through the talk and rounds only the crossings
  const ceiling = context.createGain();
  ceiling.gain.value = 0.5;
  const clip = context.createWaveShaper();
  clip.curve = Float32Array.from({ length: 1024 }, (_, index) =>
    Math.tanh(((index / 1023) * 2 - 1) * 2)
  );
  clip.oversample = '2x';
  // A black hole bends everything through a delay line whose time it stretches, sinking the pitch of the whole
  // mix like a tape slowing, and which a wobble shakes as the pull warps it. At rest it passes straight through
  const warp = context.createDelay(1.5);
  const wobble = context.createGain();
  wobble.gain.value = 0;
  const shake = context.createOscillator();
  shake.frequency.value = 5.5;
  shake.connect(wobble).connect(warp.delayTime);
  shake.start();
  tone.connect(trim).connect(glue).connect(warp);
  stage.connect(warp);
  // A portal's membrane muffles the whole mix as the talk passes through it. Open at the top of the band, it passes
  // everything unchanged
  const membrane = context.createBiquadFilter();
  membrane.frequency.value = context.sampleRate / 2;
  membrane.Q.value = 1.2;
  warp.connect(master).connect(membrane).connect(ceiling).connect(clip).connect(context.destination);

  // A large hall that waits a moment before it answers, as a real room does
  const hall = context.createGain();
  const predelay = context.createDelay(0.1);
  predelay.delayTime.value = 0.04;
  const room = context.createConvolver();
  room.buffer = impulse(context, 3.6, 1.8, 1.2, true);
  const wet = context.createGain();
  wet.gain.value = 0.7;
  hall.connect(predelay).connect(room).connect(wet).connect(score);

  // The void: a far larger space with no walls that answers after a long moment and keeps its highs, and an echo
  // that bounces between the ears, dulling a little each return, whose repeats sink into the same space
  const expanse = context.createGain();
  const distance = context.createDelay(0.5);
  distance.delayTime.value = 0.12;
  const vast = context.createConvolver();
  vast.buffer = impulse(context, 8, 0.75, 0.3, false);
  const far = context.createGain();
  far.gain.value = 0.8;
  expanse.connect(distance).connect(vast).connect(far).connect(score);
  const echo = context.createGain();
  echo.gain.value = 0.35;
  const left = context.createDelay(1);
  const right = context.createDelay(1);
  left.delayTime.value = 0.36;
  right.delayTime.value = 0.36;
  const dull = context.createBiquadFilter();
  dull.frequency.value = 5000;
  const feedback = context.createGain();
  feedback.gain.value = 0.4;
  const ears = context.createChannelMerger(2);
  const returned = context.createGain();
  returned.gain.value = 0.5;
  expanse.connect(echo).connect(left).connect(dull).connect(right).connect(feedback).connect(left);
  left.connect(ears, 0, 0);
  right.connect(ears, 0, 1);
  ears.connect(returned).connect(score);
  ears.connect(distance);

  const loop = (buffer: AudioBuffer, into: AudioNode, place: number): LoopDraw => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = buffer.duration / 2;
    source.loopEnd = buffer.duration;
    const level = context.createGain();
    level.gain.value = 0;
    const pan = context.createStereoPanner();
    pan.pan.value = place;
    source.connect(level).connect(pan).connect(into);
    pan.connect(send(context, 0.6, hall));
    source.start(0, buffer.duration / 2);
    return { source, level, pan };
  };

  return {
    context,
    samples,
    score,
    stage,
    hall,
    wet,
    expanse,
    clean,
    crushed,
    tone,
    master,
    warp,
    wobble,
    ceiling,
    membrane,
    pad: {
      layers: [samples.pad, samples.pad, samples.glade, samples.glade].map((buffer) =>
        [-0.45, 0, 0.45].map((place) => loop(buffer, score, place))
      ),
      active: 0,
      beat: '',
    },
    drone: loop(samples.drone, stage, 0),
    overtone: loop(samples.drone, stage, 0),
  };
}

/**
 * A stereo space's impulse: a dense tail of noise, different in each ear, that dies at `decay` a second over
 * `seconds` and darkens at `darkening` a second, since air takes the highs first. A room with walls answers first
 * with a few sparse early reflections, and a space without them swells in rather than starting at once.
 */
function impulse(
  context: AudioContext,
  seconds: number,
  decay: number,
  darkening: number,
  walls: boolean
) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let index = 0; index < length; index++) {
      const time = index / rate;
      low += (Math.random() * 2 - 1 - low) * (0.05 + 0.9 * Math.exp(-time * darkening));
      data[index] = low * Math.exp(-time * decay) * (walls ? 1 : 1 - Math.exp(-time / 0.15));
    }
    if (!walls) continue;
    for (let tap = 0; tap < 6; tap++) {
      data[Math.floor((0.011 + tap * 0.017 + channel * 0.007) * rate)]! +=
        (tap % 2 === 0 ? 0.7 : -0.5) * (1 - tap / 8);
    }
  }
  return buffer;
}
