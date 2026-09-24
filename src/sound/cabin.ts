import type { SoundDraw } from './traits.js';

/**
 * A recorded ship's cabin in flight. The recording loops as a bed through a low-pass, a second pass over it rushes
 * past through a band-pass on the stage, two engine cores a few cents apart swirl through a resonant filter, and
 * hollow knocks are cut from it. The bed, drone, and knocks play into `into`. A distorted cabin drives its bed into
 * a soft clip ahead of the low-pass, harder as `crunch` rises.
 */
export function createCabin(
  { context, samples, stage }: SoundDraw,
  into: AudioNode,
  distorted = false
) {
  const cabin = samples.cabin;
  const bus = context.createGain();
  bus.connect(into);

  // The bake wraps half a second of the 40 second loop onto each end of the file
  const bed = context.createBufferSource();
  bed.buffer = cabin;
  bed.loop = true;
  bed.loopStart = 0.5;
  bed.loopEnd = 40.5;
  const tone = context.createBiquadFilter();
  tone.Q.value = 0.5;
  const hull = context.createGain();
  hull.gain.value = 0;
  const drive = context.createGain();
  const makeup = context.createGain();
  if (distorted) {
    const clip = context.createWaveShaper();
    clip.curve = Float32Array.from({ length: 1024 }, (_, index) =>
      Math.tanh(((index / 1023) * 2 - 1) * 4)
    );
    clip.oversample = '2x';
    bed.connect(drive).connect(clip).connect(makeup).connect(tone);
  } else bed.connect(tone);
  tone.connect(hull).connect(bus);

  // A second pass over the recording rushes past through the warp
  const rush = context.createBufferSource();
  rush.buffer = cabin;
  rush.loop = true;
  rush.loopStart = 0.5;
  rush.loopEnd = 40.5;
  const air = context.createBiquadFilter();
  air.type = 'bandpass';
  air.Q.value = 0.8;
  const gust = context.createGain();
  gust.gain.value = 0;
  rush.connect(air).connect(gust).connect(stage);

  // Two engine cores a few cents apart swirl slowly through a resonant filter
  const drone = context.createGain();
  drone.gain.value = 0;
  const resonance = context.createBiquadFilter();
  resonance.frequency.value = 260;
  resonance.Q.value = 3;
  resonance.connect(drone).connect(bus);
  const wave = context.createPeriodicWave(
    new Float32Array(7),
    Float32Array.of(0, 1, 0.55, 0.3, 0.22, 0.1, 0.08)
  );
  const cores = [-5, 5].map((detune) => {
    const core = context.createOscillator();
    core.setPeriodicWave(wave);
    core.detune.value = detune;
    core.connect(resonance);
    return core;
  });

  bed.start(0, 0.5);
  rush.start(0, 20.5);
  for (const core of cores) core.start();

  return {
    context,
    bed,
    tone,
    hull,
    rush,
    air,
    gust,
    drone,
    cores,
    /** Drive a distorted cabin's bed from nearly clean at 0 to torn at 1, holding its loudness roughly level. */
    crunch: (amount: number, now: number) => {
      const push = 1 + amount * 14;
      drive.gain.setTargetAtTime(0.25 * push, now, 0.05);
      makeup.gain.setTargetAtTime(push ** -0.6, now, 0.05);
    },
    /** A hollow knock from a panel somewhere around the cabin. Harder knocks ring longer. */
    knock: (strength: number) => {
      const start = context.currentTime;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(strength, start + 0.008);
      envelope.gain.setTargetAtTime(0, start + 0.008, 0.04 + strength * 0.2);
      const pan = context.createStereoPanner();
      pan.pan.value = Math.random() * 1.2 - 0.6;
      const panel = context.createBiquadFilter();
      panel.type = 'bandpass';
      panel.frequency.value = 180 + Math.random() * 420;
      panel.Q.value = 2.5;
      const source = context.createBufferSource();
      source.buffer = cabin;
      source.connect(panel).connect(envelope).connect(pan).connect(bus);
      source.start(start, 0.5 + Math.random() * 38);
      source.stop(start + 1.5);
      source.onended = () => pan.disconnect();
    },
    stop: () => {
      bed.stop();
      rush.stop();
      for (const core of cores) core.stop();
      bus.disconnect();
    },
  };
}
