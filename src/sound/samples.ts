import type { SoundDraw } from './traits.js';

/** A constant, or seconds and values alternating: held at the first value, then ramped exponentially onward. */
type Curve = number | readonly number[];

let samples: Promise<SoundDraw['samples']> | undefined;

/** Bake or load each voice once and share the resulting samples. */
export function loadSamples(): Promise<SoundDraw['samples']> {
  samples ??= prepareSamples();
  return samples;
}

/**
 * Voices are rendered offline the way a late-nineties console stored them, at 11 or 22 kHz and eight bits, and the
 * mixer pitches them by playback rate like that console's sampler. The mallet, the bubble, the glint, and the
 * sparkle are kept finer, since grit on a clean decay sounds like a machine rather than a thing struck. Loops are baked twice over and repeat their settled second
 * half. The flight's cabin is a field recording rather than a bake.
 */
async function prepareSamples(): Promise<SoundDraw['samples']> {
  const [
    doo,
    chime,
    whoosh,
    gulp,
    boom,
    bloop,
    tick,
    braam,
    surge,
    glint,
    warp,
    laser,
    sparkle,
    pluck,
    swell,
    drop,
    rustle,
    veil,
    fall,
    glitch,
    flight,
    breach,
    pad,
    glade,
    drone,
    cabin,
  ] = await Promise.all([
    bake(0.3, 32_000, 12, (context) => {
      // A soft felt mallet on a wooden bar, C5: a round sine that eases a hair down into its note, the bar's faint
      // overtone near four times up damped almost at once, and a hush of noise where the mallet meets it.
      oscillator(context, 'sine', [0, 540, 0.03, 523.25], [0, 1e-4, 0.006, 1, 0.3, 1e-4]);
      oscillator(context, 'sine', 523.25 * 3.93, [0, 1e-4, 0.002, 0.12, 0.05, 1e-4]);
      noise(context, [0, 0.15, 0.012, 1e-4], filter(context, 'lowpass', 1800, 0.7));
    }),
    bake(1.6, 22_050, 8, (context) => {
      // An FM bell on C6: a sine carrier whose brightness, a modulator at 3.5 times its pitch, fades before it does.
      const carrier = oscillator(context, 'sine', 1046.5, [0, 1e-4, 0.004, 0.5, 1.6, 1e-4]);
      const depth = gain(context, [0, 2400, 0.9, 1], carrier.frequency);
      oscillator(context, 'sine', 1046.5 * 3.5, 1, depth);
      // A glassy upper partial rings briefly over it.
      oscillator(context, 'sine', 1046.5 * 2.76, [0, 1e-4, 0.002, 0.18, 0.35, 1e-4]);
    }),
    bake(0.9, 11_025, 8, (context) => {
      // Air rushing past: noise through a band that sweeps up as it swells, and back as it fades.
      noise(
        context,
        [0, 1e-4, 0.38, 0.8, 0.9, 1e-4],
        filter(context, 'bandpass', [0, 280, 0.45, 2600, 0.9, 900], 1.6)
      );
    }),
    bake(0.5, 11_025, 8, (context) => {
      // A gulp: a sine swallowing down past an octave with a wobble in its throat, and a little wet noise.
      const throat = oscillator(
        context,
        'sine',
        [0, 480, 0.32, 70],
        [0, 1e-4, 0.015, 0.9, 0.46, 1e-4]
      );
      oscillator(context, 'sine', 26, 1, gain(context, 45, throat.frequency));
      noise(context, [0, 0.3, 0.12, 1e-4], filter(context, 'lowpass', 500, 2));
    }),
    bake(2.6, 11_025, 8, (context) => {
      // The crossing: a sub drop under a burst of noise whose brightness falls away, with a crack at the front.
      oscillator(context, 'sine', [0, 120, 0.9, 28], [0, 1e-4, 0.005, 1, 2.5, 1e-4]);
      noise(context, [0, 0.9, 1.6, 1e-4], filter(context, 'lowpass', [0, 2400, 1.2, 110], 0.9));
      oscillator(context, 'triangle', [0, 260, 0.2, 50], [0, 0.6, 0.25, 1e-4]);
    }),
    bake(0.35, 32_000, 12, (context) => {
      // A glass bubble on C5: a round sine that swoops up into its note, with a glassy partial ringing a moment above
      oscillator(context, 'sine', [0, 330, 0.06, 523.25], [0, 1e-4, 0.01, 1, 0.35, 1e-4]);
      oscillator(context, 'sine', 523.25 * 2.76, [0, 1e-4, 0.02, 0.15, 0.2, 1e-4]);
    }),
    bake(0.06, 22_050, 6, (context) => {
      // A key: a click of bright noise over a square blip.
      oscillator(context, 'square', 1900, [0, 0.22, 0.03, 1e-4]);
      noise(context, [0, 0.5, 0.025, 1e-4], filter(context, 'bandpass', 3800, 1.4));
    }),
    bake(5, 22_050, 8, (context) => {
      // Something vast arriving: a horn of saws on A1 a minor second apart, with its fifth and octave, through a
      // low-pass that opens as it swells and closes as it dies, over a sub an octave below and a low rumble.
      const horn = filter(context, 'lowpass', [0, 120, 1.2, 1400, 5, 150], 2);
      for (const [pitch, level] of [
        [55, 0.5],
        [55.4, 0.5],
        [58.27, 0.35],
        [82.41, 0.3],
        [110, 0.25],
      ] as const)
        oscillator(
          context,
          'sawtooth',
          pitch,
          [0, 1e-4, 0.6, level, 1.6, level * 0.8, 5, 1e-4],
          horn
        );
      oscillator(context, 'sine', 27.5, [0, 1e-4, 0.8, 0.8, 5, 1e-4]);
      noise(context, [0, 1e-4, 0.6, 0.25, 5, 1e-4], filter(context, 'lowpass', 90, 0.8));
    }),
    bake(1.6, 11_025, 8, (context) => {
      // Power surging into the eyes: a deep sine that swells up an octave with a buzz riding it, and crackle.
      oscillator(context, 'sine', [0, 40, 0.8, 80, 1.6, 70], [0, 1e-4, 0.3, 1, 1.6, 1e-4]);
      oscillator(
        context,
        'sawtooth',
        [0, 80, 0.8, 160, 1.6, 140],
        [0, 1e-4, 0.3, 0.25, 1.6, 1e-4],
        filter(context, 'lowpass', 600, 3)
      );
      noise(context, [0, 1e-4, 0.2, 0.3, 0.6, 0.05, 1.6, 1e-4], filter(context, 'bandpass', 2400, 6));
    }),
    bake(1.8, 32_000, 12, (context) => {
      // A glint in the eyes: a high metallic ring struck hard, its inharmonic partials shimmering apart as it fades,
      // with a tritone above it for menace.
      const carrier = oscillator(context, 'sine', 2637, [0, 1e-4, 0.002, 0.6, 1.8, 1e-4]);
      oscillator(
        context,
        'sine',
        2637 * 1.41,
        1,
        gain(context, [0, 3000, 0.4, 200], carrier.frequency)
      );
      oscillator(context, 'sine', 2637 * 2.03, [0, 1e-4, 0.002, 0.3, 0.6, 1e-4]);
      oscillator(context, 'sine', 3729, [0, 1e-4, 0.002, 0.25, 1.2, 1e-4]);
    }),
    bake(2, 22_050, 8, (context) => {
      // The drive kicking in: a low thump, and detuned saws that spool up an octave through a low-pass opening with
      // them, then settle and fade as the ship reaches cruise.
      oscillator(context, 'sine', [0, 90, 0.25, 32], [0, 1e-4, 0.01, 1, 0.5, 1e-4]);
      const drive = filter(context, 'lowpass', [0, 160, 0.7, 1200, 2, 300], 1.5);
      for (const detune of [0.995, 1, 1.006])
        oscillator(
          context,
          'sawtooth',
          [0, 55 * detune, 0.7, 110 * detune, 2, 98 * detune],
          [0, 1e-4, 0.15, 0.35, 0.7, 0.45, 2, 1e-4],
          drive
        );
    }),
    bake(0.35, 22_050, 8, (context) => {
      // Laser eyes: a pew, a bright square that falls from a shriek to a low buzz in a blink, with a sine riding an
      // octave above it and a click of static where it fires.
      oscillator(
        context,
        'square',
        [0, 2400, 0.18, 260],
        [0, 1e-4, 0.003, 0.7, 0.3, 1e-4],
        filter(context, 'lowpass', [0, 7000, 0.3, 1200], 0.9)
      );
      oscillator(context, 'sine', [0, 4800, 0.16, 520], [0, 1e-4, 0.002, 0.4, 0.2, 1e-4]);
      noise(context, [0, 0.4, 0.02, 1e-4], filter(context, 'highpass', 3000, 0.7));
    }),
    bake(2.6, 32_000, 12, (context) => {
      // A spray of tiny high grains, each a few milliseconds of a sine between 4 and 9 kHz, thick at the burst and
      // thinning the way a sparkler spits. The grains are plain arithmetic, written into a buffer the bake plays.
      const grains = context.createBuffer(1, context.length, context.sampleRate);
      const data = grains.getChannelData(0);
      for (let grain = 0; grain < 90; grain++) {
        // Times fall as the square of a uniform draw, so the grains crowd the burst
        const start = 2.5 * Math.random() ** 2;
        const frequency = 4000 + 5000 * Math.random();
        const ring = 0.002 + 0.006 * Math.random();
        const level = 1 - 0.7 * (start / 2.5);
        const from = Math.floor(start * context.sampleRate);
        const length = Math.min(Math.floor(ring * 5 * context.sampleRate), data.length - from);
        for (let index = 0; index < length; index++) {
          const seconds = index / context.sampleRate;
          const envelope = Math.min(1, index / 8) * Math.exp(-seconds / ring);
          data[from + index]! += level * envelope * Math.sin(2 * Math.PI * frequency * seconds);
        }
      }
      const source = context.createBufferSource();
      source.buffer = grains;
      source.connect(context.destination);
      source.start();
    }),
    bake(1.2, 22_050, 12, (context) => {
      // A kalimba tine on C5: a round sine that rings on, its octave fading sooner, and a bright inharmonic partial
      // near five and a half times up that marks the pluck and is gone almost at once.
      oscillator(context, 'sine', 523.25, [0, 1e-4, 0.003, 1, 1.2, 1e-4]);
      oscillator(context, 'sine', 1046.5, [0, 1e-4, 0.003, 0.3, 0.3, 1e-4]);
      oscillator(context, 'sine', 523.25 * 5.4, [0, 1e-4, 0.001, 0.4, 0.06, 1e-4]);
    }),
    bake(1.4, 22_050, 8, (context) => {
      // A bell on C5 played backwards, so it swells in bright and lands on its strike.
      const carrier = oscillator(context, 'sine', 523.25, [0, 1e-4, 0.004, 0.6, 1.4, 1e-4]);
      oscillator(context, 'sine', 523.25 * 3.5, 1, gain(context, [0, 1600, 1, 1], carrier.frequency));
      oscillator(context, 'sine', 523.25 * 2.76, [0, 1e-4, 0.002, 0.2, 0.5, 1e-4]);
    }).then((buffer) => {
      buffer.getChannelData(0).reverse();
      return buffer;
    }),
    bake(0.9, 32_000, 12, (context) => {
      // Soft falling air with a faint tone beneath it as the spheres leave the frame
      oscillator(
        context,
        'sine',
        [0, 660, 0.25, 590, 0.55, 260, 0.9, 65],
        [0, 1e-4, 0.18, 0.02, 0.45, 0.1, 0.68, 0.06, 0.9, 1e-4]
      );
      noise(
        context,
        [0, 1e-4, 0.25, 0.04, 0.6, 0.5, 0.9, 1e-4],
        filter(context, 'bandpass', [0, 1200, 0.3, 900, 0.9, 180], 0.8)
      );
    }),
    bake(0.32, 32_000, 12, (context) => {
      // Paper separating into scraps, a few soft brushes of filtered noise
      noise(
        context,
        [0, 1e-4, 0.025, 0.3, 0.07, 0.08, 0.12, 0.22, 0.18, 0.05, 0.23, 0.1, 0.32, 1e-4],
        filter(context, 'bandpass', [0, 1500, 0.32, 700], 0.6)
      );
    }),
    bake(1.6, 32_000, 12, (context) => {
      // Silk brushing hollow glass, with a soft flutter that relaxes as the curtain lands
      const flutter = gain(context, 0.8);
      oscillator(context, 'sine', [0, 9, 1.6, 3], 1, gain(context, 0.16, flutter.gain));
      noise(
        context,
        [0, 1e-4, 0.18, 0.16, 0.7, 0.5, 1.15, 0.18, 1.6, 1e-4],
        filter(context, 'bandpass', [0, 1100, 0.75, 720, 1.6, 430], 5, flutter)
      );
      noise(
        context,
        [0, 1e-4, 0.3, 0.08, 0.85, 0.2, 1.6, 1e-4],
        filter(context, 'bandpass', [0, 1700, 0.9, 1200, 1.6, 650], 7, flutter)
      );
    }),
    bake(1.2, 11_025, 8, (context) => {
      // Air settling away: noise through a band that falls from a quick onset and fades as it sinks.
      noise(
        context,
        [0, 1e-4, 0.12, 0.6, 1.2, 1e-4],
        filter(context, 'bandpass', [0, 2800, 1.2, 250], 1.4)
      );
    }),
    bake(0.8, 11_025, 6, (context) => {
      // A magical glitch: a bright square stuttering through random high notes of the scale in chopped fragments,
      // with bursts of static, then a shimmer that rises away.
      const tone = context.createOscillator();
      tone.type = 'square';
      const gate = context.createGain();
      gate.gain.value = 0;
      for (const [step, frequency] of [1568, 2093, 1175, 2637, 1760, 3136, 1397, 2349].entries()) {
        const at = step * 0.05;
        tone.frequency.setValueAtTime(frequency, at);
        gate.gain.setValueAtTime(step % 3 === 2 ? 0 : 0.5 * (1 - step / 10), at);
        gate.gain.setValueAtTime(0, at + 0.035);
      }
      tone.connect(gate).connect(filter(context, 'lowpass', 5000, 1));
      tone.start();
      noise(
        context,
        [0, 1e-4, 0.05, 0.5, 0.1, 1e-4, 0.15, 0.4, 0.2, 1e-4],
        filter(context, 'bandpass', 2500, 0.8)
      );
      oscillator(context, 'sine', [0.4, 1200, 0.8, 4800], [0, 1e-4, 0.4, 1e-4, 0.45, 0.4, 0.8, 1e-4]);
    }),
    bake(3.5, 22_050, 8, (context) => {
      // A cinematic pass through space: a sub that swells and sinks, a rush of air that sweeps up and back down past
      // the ear, and a low tone that falls as it passes.
      oscillator(context, 'sine', [0, 55, 3.5, 30], [0, 1e-4, 0.4, 0.9, 1.4, 0.7, 3.5, 1e-4]);
      noise(
        context,
        [0, 1e-4, 0.5, 0.9, 1.2, 0.6, 3.5, 1e-4],
        filter(context, 'bandpass', [0, 180, 0.9, 3200, 3.5, 140], 0.9)
      );
      oscillator(
        context,
        'sawtooth',
        [0, 140, 3.5, 70],
        [0, 1e-4, 0.6, 0.25, 3.5, 1e-4],
        filter(context, 'lowpass', 900, 1)
      );
    }),
    bake(1.6, 22_050, 8, (context) => {
      // Breaking through a portal's membrane: air sucked in, rising and tightening, bursts at 0.4 seconds into a
      // soft low thump that sinks away under a breath of air let out behind it.
      noise(
        context,
        [0, 1e-4, 0.4, 0.8, 0.45, 0.02, 1.6, 1e-4],
        filter(context, 'bandpass', [0, 400, 0.4, 3000], 1.2)
      );
      oscillator(context, 'sine', [0.4, 120, 1.2, 36], [0, 1e-4, 0.4, 1e-4, 0.42, 1, 1.5, 1e-4]);
      noise(
        context,
        [0, 1e-4, 0.4, 1e-4, 0.43, 0.45, 1.5, 1e-4],
        filter(context, 'lowpass', [0.4, 1800, 1.4, 200], 0.7)
      );
    }),
    bake(8, 22_050, 8, (context) => {
      // A choir on C3: three saws a quarter hertz apart sing "ah" through the vowel's two lowest formants over a
      // darker string body whose filter breathes once each four seconds, with a soft octave below. Every part
      // repeats each four seconds.
      const body = filter(context, 'lowpass', 900, 0.7, gain(context, 0.5));
      oscillator(context, 'sine', 0.25, 1, gain(context, 350, body.frequency));
      const first = filter(context, 'bandpass', 700, 4, gain(context, 0.35));
      const second = filter(context, 'bandpass', 1150, 5, gain(context, 0.15));
      for (const pitch of [130.75, 131, 130.5]) {
        const voice = context.createOscillator();
        voice.type = 'sawtooth';
        voice.frequency.value = pitch;
        voice.connect(body);
        voice.connect(first);
        voice.connect(second);
        voice.start();
      }
      oscillator(context, 'triangle', 65.5, 0.25);
    }),
    bake(8, 22_050, 8, (context) => {
      // A glass pad on C3: a sine whose shimmer, a modulator at twice its pitch, breathes in and out once each four
      // seconds, with its octave a quarter hertz apart and its twelfth above, over a soft breath of air. Every part
      // repeats each four seconds.
      const carrier = oscillator(context, 'sine', 130.75, 0.5);
      const depth = gain(context, 60, carrier.frequency);
      oscillator(context, 'sine', 0.25, 1, gain(context, 50, depth.gain));
      oscillator(context, 'sine', 261.5, 1, depth);
      oscillator(context, 'sine', 261.75, 0.25);
      oscillator(context, 'sine', 392.25, 0.15);
      noise(context, 0.03, filter(context, 'bandpass', 3000, 2));
    }),
    bake(4, 11_025, 8, (context) => {
      // The portal: a low sine under two saws half a hertz apart, beating once every two seconds through a low-pass
      // that breathes at the same rate, over a rumble. Everything repeats each two seconds.
      const breath = filter(context, 'lowpass', 260, 4);
      oscillator(context, 'sine', 0.5, 1, gain(context, 140, breath.frequency));
      oscillator(context, 'sine', 41, 0.5);
      oscillator(context, 'sawtooth', 55, 0.25, breath);
      oscillator(context, 'sawtooth', 55.5, 0.25, breath);
      noise(context, 0.3, filter(context, 'lowpass', 140, 1));
    }),
    // A cabin that fails to load stays silent rather than stopping the talk
    fetch('./sounds/cabin.mp3')
      .then((response) => response.arrayBuffer())
      .then((data) => new OfflineAudioContext(2, 1, 48_000).decodeAudioData(data))
      .catch((error: unknown) => {
        console.error('Could not load the cabin recording', error);
        return new AudioBuffer({ length: 1, sampleRate: 48_000 });
      }),
  ]);
  return {
    doo,
    chime,
    whoosh,
    gulp,
    boom,
    bloop,
    tick,
    braam,
    surge,
    glint,
    warp,
    laser,
    sparkle,
    pluck,
    swell,
    drop,
    rustle,
    veil,
    fall,
    glitch,
    flight,
    breach,
    pad,
    glade,
    drone,
    cabin,
  };
}

/**
 * Render `seconds` of a patch at `rate`, bring its peak up to full scale so the quiet ones keep every step of their
 * depth, and keep `bits` of it. How loud each voice plays is the mixer's to set.
 */
async function bake(
  seconds: number,
  rate: number,
  bits: number,
  patch: (context: OfflineAudioContext) => void
): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  patch(context);
  const buffer = await context.startRendering();
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]!));
  const steps = 2 ** (bits - 1) - 1;
  const scale = (steps * 0.95) / peak;
  for (let index = 0; index < data.length; index++)
    data[index] = Math.round(data[index]! * scale) / steps;
  return buffer;
}

function shape(param: AudioParam, curve: Curve) {
  if (typeof curve === 'number') {
    param.value = curve;
    return;
  }
  param.setValueAtTime(curve[1]!, curve[0]!);
  for (let index = 2; index < curve.length; index += 2)
    param.exponentialRampToValueAtTime(curve[index + 1]!, curve[index]!);
}

/** A gain stage into `into`, which may be another node's parameter, as when one oscillator modulates another. */
function gain(
  context: OfflineAudioContext,
  level: Curve,
  into: AudioNode | AudioParam = context.destination
) {
  const node = context.createGain();
  shape(node.gain, level);
  // `connect` is overloaded for nodes and parameters, so each is connected through its own overload
  if (into instanceof AudioParam) node.connect(into);
  else node.connect(into);
  return node;
}

function oscillator(
  context: OfflineAudioContext,
  type: OscillatorType,
  frequency: Curve,
  level: Curve,
  into: AudioNode = context.destination
) {
  const source = context.createOscillator();
  source.type = type;
  shape(source.frequency, frequency);
  source.connect(gain(context, level, into));
  source.start();
  return source;
}

/** White noise from a second-long buffer on repeat, so a loop holding it repeats exactly each second. */
function noise(context: OfflineAudioContext, level: Curve, into: AudioNode) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain(context, level, into));
  source.start();
}

function filter(
  context: OfflineAudioContext,
  type: BiquadFilterType,
  frequency: Curve,
  q: number,
  into: AudioNode = context.destination
) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.Q.value = q;
  shape(node.frequency, frequency);
  node.connect(into);
  return node;
}
