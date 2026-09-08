import type { World } from 'koota';
import { lerp } from 'math';
import { getRevealProgress } from '../timeline.js';
import { Anchor, Camera, Hidden, Position, ProfileFocus, Rotation, Size } from '../traits/index.js';

/** Center the storyteller and arrange nearby portraits in a floating ring at their own depths. */
export function focusProfiles(world: World) {
  const entity = world.queryFirst(Camera, Position);
  if (!entity) return;
  const camera = entity.get(Position)!;
  const vertical = Math.tan((entity.get(Camera)!.fov * Math.PI) / 360);
  const progress = getRevealProgress(world);
  world
    .query(ProfileFocus, Position, Rotation, Anchor, Size)
    .updateEach(([focus, position, rotation, anchor, size], profile) => {
      focus.value = lerp(focus.from, focus.to, progress);
      if (profile.has(Hidden)) return;
      focus.scale = 1;
      if (focus.value === 0) return;
      if (focus.slot >= 0 && focus.count > 0) {
        const angle = Math.PI / 2 + (focus.slot / focus.count) * Math.PI * 2;
        const halfHeight = (camera.z - position.z) * vertical;
        // Match apparent portrait size across depths without changing the original geometry.
        focus.scale = lerp(1, (halfHeight * 0.13) / size.radius, focus.value);
        // Project the ring consistently across depth layers while retaining each portrait's drift.
        const x = camera.x + Math.cos(angle) * halfHeight * 0.52 + position.x - anchor.x;
        const y = camera.y + Math.sin(angle) * halfHeight * 0.44 + position.y - anchor.y;
        position.x = lerp(position.x, x, focus.value);
        position.y = lerp(position.y, y, focus.value);
      } else {
        position.x = lerp(position.x, camera.x, focus.value);
        position.y = lerp(position.y, camera.y, focus.value);
        rotation.x *= 1 - focus.value;
        rotation.y *= 1 - focus.value;
        rotation.z *= 1 - focus.value;
      }
    });
}
