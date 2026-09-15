import { profileActions } from './actions.js';
import { type ProfileLayout, teamLayout } from './utils/layout.js';
import { Bounds, Camera } from '../camera/traits.js';
import { IsHidden, IsPresent, Position, Rotation, Size } from '../traits.js';
import {
  TransitionOrigin,
  ActiveScreen,
  Screen,
  Timeline,
  ScreenTransition,
} from '../timeline/traits.js';
import { Time } from '../time/traits.js';
import { Anchor, Float } from '../floating/traits.js';
import { Ref } from '../view/traits.js';
import type { Entity, World } from 'koota';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { Color, Vector3, type Camera as ThreeCamera, type Scene } from 'three';
import { communityDepartureTime, profileArrival } from './utils/motion.js';
import { Profile, ProfileFocus, ProfileParts, ProfilePresence, TeamNetwork } from './traits.js';
import { getRevealTime, getTransitionProgress } from '../timeline/timing.js';
import { mulberry32 } from 'math/random';
import { ramp } from '../theme.js';

// Ring colors for a portrait in front and one that has receded behind the newcomers
const light = new Color(ramp['light-25']);
const shadow = new Color('#141726');

/**
 * Advance each portrait's presence and apply it to the mounted portrait, ring, and aura.
 * A portrait that has finished leaving releases its view.
 */
export function animateProfiles(world: World) {
  const reveal = getRevealTime(world);
  const transition = getTransitionProgress(world);
  const retired: Entity[] = [];
  world.query(Profile, ProfilePresence, ProfileFocus).updateEach(([, presence, focus], entity) => {
    presence.value = lerp(
      presence.from,
      presence.target,
      presence.focusing ? profileArrival(reveal, focus.slot, focus.count) : transition
    );
    if (!entity.has(IsPresent)) return;

    const group = entity.get(Ref);
    const parts = entity.get(ProfileParts);
    if (group && parts?.portrait && parts.border) {
      group.scale.setScalar(Math.max(0.001, presence.value * focus.scale));
      // Receding portraits also thin out, letting the wall read through them. The spring
      // settles past its mark, which belongs in the motion rather than the fade.
      const faded = clamp(presence.value, 0, 1) * (1 - focus.recede * 0.45) * focus.wanderOpacity;
      group.visible = faded > 0;
      parts.portrait.opacity = faded;
      parts.border.opacity = faded;
      parts.dim.value = focus.recede * 0.72;
      parts.border.color.lerpColors(light, shadow, parts.dim.value);
      if (parts.aura) parts.aura.visible = parts.auraReveal.value > 0;
    }
    // Only retire a portrait once it has faded out. A portrait waiting on a screen's
    // reveal delay also sits at zero, and retiring it there would keep it off screen.
    if (presence.value === 0 && presence.target === 0) {
      if (group) group.visible = false;
      retired.push(entity);
    }
  });
  for (const entity of retired) profileActions(world).finishProfileExit(entity);
}

const point = new Vector3();

/**
 * Links follow the settled team's projected portraits and stop at each portrait's edge.
 * Runs after every view callback so the robot's placed transform is final for the frame.
 */
export function layoutTeamConnections(
  world: World,
  camera: ThreeCamera,
  scene: Scene,
  viewportAt: (target: Vector3) => { width: number; height: number }
) {
  const data = world.queryFirst(Timeline)?.targetFor(ActiveScreen)?.get(Screen);
  world.query(TeamNetwork).updateEach(([network]) => {
    const group = network.group;
    if (!group) return;
    group.visible = network.opacity.value > 0;
    if (!group.visible) return;
    const { nodes, connections, story } = network;
    const depth = camera.position.z - 15;
    point.set(camera.position.x, camera.position.y, depth);
    const framing = viewportAt(point);
    group.position.copy(point);
    const visible = story
      ? !!data?.storyConnectionsVisible
      : !!data?.robotFriendly && !data.charterVisible && !data.announcementVisible;
    // Freeze the network during its exit so departing portraits do not stretch the links.
    if (visible) {
      const profiles = world.query(Profile, Position, ProfileFocus, Size);
      for (let index = 0; index < teamLayout.profiles.length; index++) {
        const login = data?.surroundingProfiles[index];
        const member = profiles.find((entity) => entity.get(Profile)!.login === login);
        if (!member) {
          group.visible = false;
          return;
        }
        const position = member.get(Position)!;
        if (position.z >= camera.position.z - 0.1) {
          group.visible = false;
          return;
        }
        point.set(position.x, position.y, position.z).project(camera);
        nodes[index].x = point.x * framing.width * 0.5;
        nodes[index].y = point.y * framing.height * 0.5;
        nodes[index].radius =
          (member.get(Size)!.radius * member.get(ProfileFocus)!.scale * 15) /
          (camera.position.z - position.z);
      }
      network.robot ??= scene.getObjectByName('robot-team-center');
      if (!network.robot) {
        group.visible = false;
        return;
      }
      network.robot.updateWorldMatrix(true, false);
      network.robot.getWorldPosition(point);
      if (point.z >= camera.position.z - 0.1) {
        group.visible = false;
        return;
      }
      point.project(camera);
      // The robot's rotated bounding box is larger than the head inside it, so its links tuck
      // in to the silhouette instead of stopping short of the face
      nodes[teamLayout.profiles.length].x = point.x * framing.width * 0.5;
      nodes[teamLayout.profiles.length].y = point.y * framing.height * 0.5;
      nodes[teamLayout.profiles.length].radius =
        framing.height *
        0.5 *
        teamLayout.radius *
        Math.min(1, framing.width / framing.height / 1.5) *
        (data?.charterFocus ? 0.5 : 1) *
        0.72;
    }
    for (let index = 0; index < connections.length; index++) {
      const [source, to] = connections[index];
      const start = nodes[source];
      const end = nodes[to];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      const length = Math.max(0, distance - start.radius - end.radius);
      const link = group.children[index];
      const progress = clamp(
        network.opacity.value * 1.4 -
          (story ? (index / (connections.length - 1)) * 0.4 : index * 0.025),
        0,
        1
      );
      const middle = (start.radius + length * 0.5) / Math.max(distance, 0.001);
      link.position.set(start.x + dx * middle, start.y + dy * middle, 0);
      link.rotation.z = Math.atan2(dy, dx);
      link.scale.set(length * progress, framing.height * 0.018, 1);
    }
  });
}

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

    if (entity.has(IsHidden)) return;
    // Project offsets at each portrait's depth so every path clears the viewport
    const halfHeight = Math.max(0, camera.z - position.z) * vertical;
    position.x += focus.wanderX * halfHeight * aspect;
    position.y += focus.wanderY * halfHeight;
  });
}

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
      if (profile.has(IsHidden)) return;
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

/**
 * Cache the seeded packing in caller-owned storage, then project it into the framing.
 * Unchanged frames take O(n), repacking takes O(32 n²), and storage takes O(capacity).
 * Invalid framing or exhausted capacity returns false without moving any portraits.
 */
export function placeProfiles(world: World, layout: ProfileLayout): boolean {
  const bounds = world.get(Bounds);
  const camera = world.queryFirst(Camera)?.get(Camera);
  const destination = world
    .query(Screen, ScreenTransition)
    .find((entity) => entity.get(Screen)!.profilesVisible)
    ?.get(ScreenTransition);
  if (!bounds || !camera || !destination) return false;

  const profiles = world.query(Profile, Anchor, Size, Float);
  const aspect = bounds.width / bounds.height;
  const vertical = Math.tan((camera.fov * Math.PI) / 360);
  if (
    profiles.length > layout.capacity ||
    !(bounds.width > 0 && bounds.height > 0 && aspect > 0) ||
    !Number.isFinite(aspect) ||
    !(camera.fov > 0 && camera.fov < 180) ||
    !Number.isFinite(destination.cameraX) ||
    !Number.isFinite(destination.cameraY)
  ) {
    layout.count = -1;
    return false;
  }

  let valid = true;
  profiles.useStores(([profile, anchor, size, motion], entities) => {
    // Ignore aspect roundoff from a moving viewport, far below one pixel at 8K.
    let changed =
      layout.count !== entities.length ||
      !Number.isFinite(layout.aspect) ||
      Math.abs(aspect - layout.aspect) > 1e-12;
    const { inputs, points, seed } = layout;
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i].id();
      const halfHeight = (destination.cameraZ - anchor.z[id]) * vertical;
      const radius = (size.radius[id] + motion.amplitude[id] + 0.05) / halfHeight;
      if (
        !(halfHeight > 0) ||
        !Number.isFinite(halfHeight) ||
        !Number.isFinite(radius) ||
        radius < 0 ||
        !Number.isFinite(profile.index[id])
      ) {
        layout.count = -1;
        valid = false;
        return;
      }
      const offset = i * 3;
      if (
        inputs[offset] !== profile.index[id] ||
        inputs[offset + 1] !== halfHeight ||
        inputs[offset + 2] !== radius
      )
        changed = true;
      inputs[offset] = profile.index[id];
      inputs[offset + 1] = halfHeight;
      inputs[offset + 2] = radius;
    }

    if (changed) {
      for (let i = 0; i < entities.length; i++) {
        seed.a = (inputs[i * 3] + 1) | 0;
        const radius = inputs[i * 3 + 2];
        const width = Math.max(0, aspect - radius - 0.05);
        const height = Math.max(0, 1 - radius - 0.05);
        let clearance = -Infinity;

        // Pick the roomiest seeded candidate, allowing space for the float orbit.
        for (let candidate = 0; candidate < 32; candidate++) {
          const angle = mulberry32.sample(seed) * (Math.PI * 2);
          const spread = Math.sqrt(mulberry32.sample(seed));
          const x = Math.cos(angle) * spread * width;
          const y = Math.sin(angle) * spread * height;
          let nearest = Infinity;
          for (let j = 0; j < i; j++) {
            nearest = Math.min(
              nearest,
              Math.hypot(x - points[j * 2], y - points[j * 2 + 1]) - radius - inputs[j * 3 + 2]
            );
          }
          if (nearest > clearance) {
            points[i * 2] = x;
            points[i * 2 + 1] = y;
            clearance = nearest;
          }
        }
      }
      layout.count = entities.length;
      layout.aspect = aspect;
    }

    for (let i = 0; i < entities.length; i++) {
      const id = entities[i].id();
      anchor.x[id] = destination.cameraX + points[i * 2] * inputs[i * 3 + 1];
      anchor.y[id] = destination.cameraY + points[i * 2 + 1] * inputs[i * 3 + 1];
    }
  });
  return valid;
}
