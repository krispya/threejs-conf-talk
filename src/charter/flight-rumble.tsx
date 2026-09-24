import { useTrait, useWorld } from 'koota/react';
import { lerp } from 'math';
import { useRef, type RefObject } from 'react';
import { createCabin } from '../sound/cabin.js';
import { SoundView } from '../sound/traits.js';
import { useFrameStep, useResource, type FrameStep } from '../view/hooks.js';

/** What the flight out of the black hole hands its sound each frame, each from 0 to 1. */
export interface FlightSound {
  /** The camera's speed out to the stars. */
  speed: number;
  /** The pop's kick, fading as the flight begins. */
  kick: number;
  /** The latest jolt of the hull and which one it is. */
  jolt: number;
  hit: number;
}

/**
 * Shot out of the black hole at warp speed. The pop kicks the ship's cabin into a low, torn roar that spools up in
 * pitch with the camera's speed, driven into distortion the whole way, while the recording rushes past brighter
 * and higher, the engine drones beneath, and the hull knocks on every jolt the camera takes. It all spins down as
 * the camera slows into the stars. It plays on the stage, since the music is silenced from the pop.
 */
export function FlightRumble({
  flight,
  steps,
}: {
  flight: RefObject<FlightSound>;
  steps: Set<FrameStep>;
}) {
  const world = useWorld();
  const view = useTrait(world, SoundView);
  const [, rumbleRef] = useResource(
    () => view && createCabin(view, view.stage, true),
    (rumble) => rumble?.stop(),
    [view]
  );
  const last = useRef({ hit: -1, knock: 0 });

  // Reads the flight the collapse published on the previous frame
  useFrameStep(steps, () => {
    const rumble = rumbleRef.current;
    if (!rumble) return;
    const { speed, kick, jolt, hit } = flight.current;
    const now = rumble.context.currentTime;
    // The camera's speed peaks sharply mid flight, so the cabin swells well ahead of it and holds on after
    const surge = Math.sqrt(speed);

    const loudness = kick * 0.4 + surge * 0.34;
    rumble.hull.gain.setTargetAtTime(loudness, now, loudness > rumble.hull.gain.value ? 0.03 : 0.25);
    rumble.crunch(Math.max(kick, surge) * 0.9, now);
    rumble.bed.playbackRate.setTargetAtTime(lerp(0.5, 1.45, surge), now, 0.08);
    rumble.tone.frequency.setTargetAtTime(400 + kick * 1300 + surge * 5200, now, 0.05);

    rumble.gust.gain.setTargetAtTime(speed * 0.55, now, 0.08);
    rumble.rush.playbackRate.setTargetAtTime(lerp(0.8, 2.3, speed), now, 0.08);
    rumble.air.frequency.setTargetAtTime(lerp(300, 3800, speed ** 2), now, 0.05);

    for (const core of rumble.cores) core.frequency.setTargetAtTime(36 + surge * 34, now, 0.1);
    rumble.drone.gain.setTargetAtTime(Math.max(kick, surge) * 0.06, now, 0.1);

    // Each jolt of the hull knocks, and smaller knocks scatter between them at speed
    const previous = last.current;
    if (hit !== previous.hit && jolt > 0.05) rumble.knock(jolt * 0.5);
    previous.hit = hit;
    if (speed > 0.2 && now >= previous.knock) {
      rumble.knock(Math.random() ** 2 * speed * 0.12);
      previous.knock = now + (0.1 + Math.random() * 0.4) / (0.5 + speed * 2);
    }
  });

  return null;
}
