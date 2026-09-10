import type { World } from 'koota';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { profileArrival } from '../profile-arrival.js';
import { teamLayout } from '../team-layout.js';
import { getRevealTime } from '../timeline.js';
import {
  ActiveScreen,
  Anchor,
  Bounds,
  Camera,
  Hidden,
  Position,
  Profile,
  ProfileFocus,
  Rotation,
  Screen,
  Size,
  Time,
  Timeline,
  TransitionOrigin,
} from '../traits/index.js';

/** Center the storyteller and arrange nearby portraits in a floating ring at their own depths. */
export function focusProfiles(world: World) {
  const entity = world.queryFirst(Camera, Position);
  if (!entity) return;
  const camera = entity.get(Position)!;
  const vertical = Math.tan((entity.get(Camera)!.fov * Math.PI) / 360);
  const time = getRevealTime(world);
  const timeline = world.queryFirst(Timeline);
  const data = timeline?.targetFor(ActiveScreen)?.get(Screen);
  const teamCamera = camera;
  const elapsed = world.get(Time)!.elapsed - (timeline?.get(Timeline)?.startedAt ?? 0);
  const bounds = world.get(Bounds);
  world
    .query(ProfileFocus, Position, Rotation, Anchor, Size)
    .updateEach(([focus, position, rotation, anchor, size], profile) => {
      // Each portrait rides its own staggered spring, so the ring gathers and settles
      const progress = profileArrival(time, focus.slot, focus.count);
      focus.value = lerp(focus.from, focus.to, progress);
      // The overshoot belongs to the motion, not to how far back a portrait reads
      focus.recede = clamp(lerp(focus.recedeFrom, focus.recedeTo, progress), 0, 1);
      if (profile.has(Hidden)) return;
      const origin = profile.get(TransitionOrigin);
      if (data?.teamVisible && origin) {
        const slot = data.surroundingProfiles.indexOf(profile.get(Profile)!.login);
        const progress =
          data.charterVisible || data.announcementVisible
            ? easing.cubicInOut(time)
            : easing.cubicInOut(clamp((elapsed - 0.65 - slot * 0.15) / 1.8, 0, 1));
        const halfHeight = (teamCamera.z - position.z) * vertical;
        const aspect = (bounds?.width ?? 0) / (bounds?.height || 1);
        const fit = Math.min(1, aspect / 1.5);
        const place = teamLayout.profiles[slot];
        const protagonist = data.storyProfile === profile.get(Profile)!.login;
        const x = protagonist
          ? 0
          : data.robotFriendly
            ? place[0] * fit * (data.charterFocus ? 0.8 : 1)
            : (slot - 0.5) * Math.min(0.72, aspect * 0.58);
        const y = protagonist
          ? -0.55
          : data.robotFriendly
            ? place[1] * (data.charterFocus ? 0.4 : 1)
            : 0;
        // Keep each portrait's original float orbit around its place in the team
        position.x = lerp(origin.x, teamCamera.x + x * halfHeight + position.x - anchor.x, progress);
        position.y = lerp(origin.y, teamCamera.y + y * halfHeight + position.y - anchor.y, progress);
        position.z = lerp(origin.z, position.z, progress);
        focus.scale = lerp(
          focus.scaleFrom,
          (halfHeight *
            (protagonist
              ? 0.235 * fit
              : data.robotFriendly
                ? teamLayout.radius * fit * (data.charterFocus ? 0.5 : 1)
                : 0.22)) /
            size.radius,
          progress
        );
        return;
      }
      focus.scale = 1;
      if (focus.value === 0 && !focus.fromTeam) return;
      // Receding portraits draw back into a tighter, smaller ring so the newcomers own the front
      const depth = lerp(1, 0.52, focus.recede);
      if (focus.slot >= 0 && focus.count > 0) {
        // Half a step of offset nestles the receded ring between the portraits in front
        const angle = Math.PI / 2 + ((focus.slot + focus.recede * 0.5) / focus.count) * Math.PI * 2;
        const halfHeight = (camera.z - position.z) * vertical;
        // A fuller ring reads smaller and sits further out, so its portraits never collide.
        // Rings of six or fewer are left alone.
        const crowd = Math.min(1, Math.sqrt(7 / focus.count));
        // Match apparent portrait size across depths without changing the original geometry.
        focus.scale = lerp(1, (halfHeight * 0.13 * crowd * depth) / size.radius, focus.value);
        // Project the ring consistently across depth layers while retaining each portrait's drift.
        const reach = lerp(1, 0.58, focus.recede) * (2 - crowd);
        const x = camera.x + Math.cos(angle) * halfHeight * 0.52 * reach + position.x - anchor.x;
        const y = camera.y + Math.sin(angle) * halfHeight * 0.44 * reach + position.y - anchor.y;
        position.x = lerp(position.x, x, focus.value);
        position.y = lerp(position.y, y, focus.value);
      } else {
        focus.scale = lerp(1, depth, focus.value);
        position.x = lerp(position.x, camera.x, focus.value);
        position.y = lerp(position.y, camera.y, focus.value);
        rotation.x *= 1 - focus.value;
        rotation.y *= 1 - focus.value;
        rotation.z *= 1 - focus.value;
      }
      if (focus.fromTeam && origin) {
        const returning = easing.cubicInOut(clamp(elapsed / 2.4, 0, 1));
        position.x = lerp(origin.x, position.x, returning);
        position.y = lerp(origin.y, position.y, returning);
        position.z = lerp(origin.z, position.z, returning);
        focus.scale = lerp(focus.scaleFrom, focus.scale, returning);
      }
    });
}
