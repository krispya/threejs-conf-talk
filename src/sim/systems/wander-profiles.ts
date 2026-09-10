import type { World } from 'koota';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { communityDepartureTime } from '../community-departure.js';
import {
  ActiveScreen,
  Bounds,
  Camera,
  Hidden,
  Position,
  Profile,
  ProfileFocus,
  Screen,
  Time,
  Timeline,
} from '../traits/index.js';

/** Add independent winding exits after the ring layout, in O(n) without per-profile allocations. */
export function wanderProfiles(world: World) {
  const timeline = world.queryFirst(Timeline);
  const cameraEntity = world.queryFirst(Camera, Position);
  const bounds = world.get(Bounds);
  if (!timeline || !cameraEntity || !bounds || bounds.width <= 0 || bounds.height <= 0) return;
  const data = timeline.targetFor(ActiveScreen)?.get(Screen);
  const wandering = data?.communityDeparture ?? false;
  const elapsed = Math.max(0, world.get(Time)!.elapsed - timeline.get(Timeline)!.startedAt);
  const departureElapsed = world.get(Time)!.elapsed - timeline.get(Timeline)!.departureStartedAt;
  const camera = cameraEntity.get(Position)!;
  const vertical = Math.tan((cameraEntity.get(Camera)!.fov * Math.PI) / 360);
  const aspect = bounds.width / bounds.height;

  world.query(Profile, ProfileFocus, Position).updateEach(([profile, focus, position], entity) => {
    if (data?.teamVisible) {
      // Team arrivals start at the captured world position, including any wandering offset
      focus.wanderX = 0;
      focus.wanderY = 0;
      focus.wanderOpacity = lerp(
        focus.wanderFromOpacity,
        1,
        easing.cubicInOut(clamp((elapsed - 0.65) / 1.2, 0, 1))
      );
      return;
    }
    if (wandering) {
      const wanderingTime = communityDepartureTime(departureElapsed) - (profile.index % 5) * 0.18;
      const progress = clamp(wanderingTime / (20 + (profile.index % 7) * 1.3), 0, 1);
      const travel = progress * progress * (3 - 2 * progress);
      const returning = easing.cubicInOut(clamp(departureElapsed / 2.4, 0, 1));
      // Soften the portraits after a short drift while keeping a faint trace
      focus.wanderOpacity =
        lerp(focus.wanderFromOpacity, 1, returning) *
        (0.2 + 0.8 * (1 - easing.cubicInOut(clamp((wanderingTime - 1) / 6, 0, 1))));
      // The golden angle spreads headings, while phase and speed vary each winding path
      const heading = profile.index * Math.PI * (3 - Math.sqrt(5));
      const phase = profile.index * 0.91;
      const bend =
        Math.sin(progress * Math.PI) *
        0.35 *
        (Math.sin(phase + progress * Math.PI * 4) - Math.sin(phase));
      focus.wanderX =
        lerp(focus.wanderFromX, 0, returning) +
        Math.cos(heading) * 3.2 * travel -
        Math.sin(heading) * bend;
      focus.wanderY =
        lerp(focus.wanderFromY, 0, returning) +
        Math.sin(heading) * 3.2 * travel +
        Math.cos(heading) * bend;
    } else {
      const returning = easing.cubicInOut(clamp(elapsed / 2.4, 0, 1));
      focus.wanderX = lerp(focus.wanderFromX, 0, returning);
      focus.wanderY = lerp(focus.wanderFromY, 0, returning);
      focus.wanderOpacity = lerp(focus.wanderFromOpacity, 1, returning);
    }

    if (entity.has(Hidden)) return;
    // Project offsets at each portrait's depth so every path clears the viewport
    const halfHeight = Math.max(0, camera.z - position.z) * vertical;
    position.x += focus.wanderX * halfHeight * aspect;
    position.y += focus.wanderY * halfHeight;
  });
}
