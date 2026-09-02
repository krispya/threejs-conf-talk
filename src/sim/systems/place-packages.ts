import { Not, type World } from 'koota';
import { Anchor, Bounds, Package, Size } from '../traits/index.js';

/** Blobs float in front of the letters, where the visible area is a bit smaller. */
const DEPTH = 1.2;
const DEPTH_SCALE = 0.85;
const GAP = 0.15;

/**
 * Drops each new package blob at a random spot, then nudges overlapping anchors apart
 * every frame until they settle. Bounds keep them on screen.
 */
export function placePackages(world: World) {
  const bounds = world.get(Bounds);
  if (!bounds || bounds.width === 0) return;

  const halfWidth = (bounds.width / 2) * DEPTH_SCALE;
  const halfHeight = (bounds.height / 2) * DEPTH_SCALE;

  world.query(Package, Size, Not(Anchor)).updateEach(([, size], entity) => {
    entity.add(
      Anchor({
        x: (Math.random() * 2 - 1) * (halfWidth - size.radius),
        y: (Math.random() * 2 - 1) * (halfHeight - size.radius),
        z: DEPTH + Math.random() * 0.3,
      })
    );
  });

  world.query(Package, Size, Anchor).useStores(([, size, anchor], entities) => {
    for (let i = 0; i < entities.length; i++) {
      const a = entities[i].id();
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j].id();

        const dx = anchor.x[b] - anchor.x[a];
        const dy = anchor.y[b] - anchor.y[a];
        const minDist = size.radius[a] + size.radius[b] + GAP;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;

        const dist = Math.sqrt(distSq) || 0.001;
        const push = ((minDist - dist) / dist) * 0.5;
        anchor.x[a] -= dx * push;
        anchor.y[a] -= dy * push;
        anchor.x[b] += dx * push;
        anchor.y[b] += dy * push;
      }
    }

    for (const entity of entities) {
      const id = entity.id();
      const limitX = Math.max(0, halfWidth - size.radius[id]);
      const limitY = Math.max(0, halfHeight - size.radius[id]);
      anchor.x[id] = Math.max(-limitX, Math.min(limitX, anchor.x[id]));
      anchor.y[id] = Math.max(-limitY, Math.min(limitY, anchor.y[id]));
    }
  });
}
