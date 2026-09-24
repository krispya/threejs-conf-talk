import { useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { useRef } from 'react';
import { soundActions } from '../sound/actions.js';
import { createCabin } from '../sound/cabin.js';
import { SoundView } from '../sound/traits.js';
import { useFrameStep, useResource, type FrameStep } from '../view/hooks.js';
import type { useTitleFlight } from './use-flight.js';

/**
 * Inside the ship, a recorded cabin rumble plays while flying and swells, brightens, and speeds up
 * with the camera shake. Little knocks and a rush that pitches up toward the portal are cut from
 * the same recording, the drive kicks in on launch, and a faint engine drone sits underneath.
 */
export function TitleRumble({
  flight,
  steps,
}: {
  flight: ReturnType<typeof useTitleFlight>['motion'];
  steps: Set<FrameStep>;
}) {
  const world = useWorld();
  const view = useTrait(world, SoundView);
  // The cabin, its knocks, and its drone play in the score, and the rush into the portal plays on the stage
  const [, rumbleRef] = useResource(
    () => view && createCabin(view, view.score),
    (rumble) => rumble?.stop(),
    [view]
  );
  const last = useRef({ boost: 0, knock: 0 });

  // Runs after the flight clock of the title's frame callback
  useFrameStep(steps, () => {
    const rumble = rumbleRef.current;
    if (!rumble) return;
    const { boost, shake, bump, warp } = flight.current;
    const now = rumble.context.currentTime;
    const flying = Math.min(1, boost);
    // Warp intensity climbs from cruise at boost 1 to full warp at boost 4
    const surge = clamp((boost - 1) / 3, 0, 1);
    const lurch = Math.abs(bump) * flying;

    // Rise with the shake and let the cabin settle slowly
    const loudness = flying * 0.2 + Math.tanh(shake * 8) * 0.6 + lurch * 0.2;
    rumble.hull.gain.setTargetAtTime(loudness, now, loudness > rumble.hull.gain.value ? 0.05 : 0.3);
    rumble.tone.frequency.setTargetAtTime(
      1800 + boost * 400 + shake * 8000 + lurch * 1500,
      now,
      0.05
    );
    rumble.bed.playbackRate.setTargetAtTime(0.9 + surge * 0.2 + shake * 0.3, now, 0.2);

    for (const core of rumble.cores)
      core.frequency.setTargetAtTime(41 + boost * 14 + surge * warp * 20, now, 0.08);
    rumble.drone.gain.setTargetAtTime(flying * lerp(0.03, 0.05, surge), now, 0.1);

    // The rush pitches up faster and faster toward the portal, then holds its pitch as it fades
    rumble.rush.playbackRate.setTargetAtTime(lerp(0.8, 2.4, warp ** 2), now, 0.05);
    rumble.air.frequency.setTargetAtTime(lerp(300, 3000, warp ** 2), now, 0.05);
    rumble.gust.gain.setTargetAtTime(surge * lerp(0.15, 0.7, warp), now, 0.1);

    // Mostly small knocks with the occasional harder one, closer together as the shake grows
    const previous = last.current;
    if (flying > 0.05 && now >= previous.knock) {
      rumble.knock(Math.random() ** 2 * (0.18 + shake * 3));
      previous.knock = now + (0.15 + Math.random() * 0.6) / (0.6 + shake * 12);
    }
    // The drive kicks in as the ship jumps to cruise
    if (previous.boost < 0.05 && boost >= 0.05) soundActions(world).cueSound('warp', 0, 1, 0.3);
    previous.boost = boost;
  });

  return null;
}
