import { Not, type World } from 'koota';
import { random } from 'math/random';
import { packageLabelSize } from '../../package-label.js';
import {
  Anchor,
  ActiveScreen,
  Bounds,
  Camera,
  Float,
  Hidden,
  Package,
  Screen,
  ScreenTransition,
  Size,
  Timeline,
} from '../traits/index.js';

/**
 * Fills open space in the package screen's framing, then separates nearby blobs.
 * Frustum margins leave room for each sphere, its label, and its float orbit.
 */
export function placePackages(world: World) {
  const bounds = world.get(Bounds);
  const camera = world.queryFirst(Camera)?.get(Camera);
  const screen = world.queryFirst(Timeline)?.targetFor(ActiveScreen);
  const data = screen?.get(Screen);
  const destination =
    screen?.get(ScreenTransition) ??
    world
      .query(Screen, ScreenTransition)
      .find((entity) => entity.get(Screen)!.packagesVisible)
      ?.get(ScreenTransition);
  if (!bounds?.height || !camera || !destination) return;

  const vertical = Math.tan((camera.fov * Math.PI) / 360);
  const horizontal = vertical * (bounds.width / bounds.height);
  const limits = (z: number, radius: number, amplitude: number, name: string) => {
    const distance = destination.cameraZ - z - amplitude * 0.5;
    const halfWidth = Math.max(radius, packageLabelSize(radius, name).width / 2);
    return {
      // Labels span the front of the sphere, closer to the camera than its widest slice
      x: Math.max(0, (distance - radius - 0.04) * horizontal - halfWidth - amplitude - 0.1),
      y: Math.max(
        0,
        distance * vertical - radius * Math.sqrt(1 + vertical * vertical) - amplitude - 0.1
      ),
    };
  };

  if (data?.packageLayout === 'pair') {
    const packages = [...world.query(Package, Size, Float, Not(Hidden))].sort(
      (a, b) =>
        data.packageNames.indexOf(a.get(Package)!.name) -
        data.packageNames.indexOf(b.get(Package)!.name)
    );
    const radii = packages.map((entity) => entity.get(Size)!.radius + entity.get(Float)!.amplitude);
    let cursor = -radii.reduce((sum, radius) => sum + radius, 0) - (packages.length - 1) * 0.2;
    packages.forEach((entity, index) => {
      const pkg = entity.get(Package)!;
      const limit = limits(
        1.4,
        entity.get(Size)!.radius,
        entity.get(Float)!.amplitude,
        pkg.label || pkg.name
      );
      const x = cursor + radii[index];
      cursor += radii[index] * 2 + 0.4;
      const anchor = {
        x: destination.cameraX + Math.max(-limit.x, Math.min(limit.x, x)),
        y: destination.cameraY,
        z: 1.4,
      };
      if (entity.has(Anchor)) entity.set(Anchor, anchor);
      else entity.add(Anchor(anchor));
    });
    return;
  }

  world
    .query(Package, Size, Float, Not(Anchor), Not(Hidden))
    .updateEach(([pkg, size, motion], entity) => {
      const z = random.float(Math.random, 1.2, 1.5);
      const limit = limits(z, size.radius, motion.amplitude, pkg.label || pkg.name);
      const placed = world.query(Package, Size, Float, Anchor, Not(Hidden));
      let x = destination.cameraX;
      let y = destination.cameraY;
      let clearance = -Infinity;

      for (let candidate = 0; candidate < 32; candidate++) {
        const nextX = destination.cameraX + random.float(Math.random, -limit.x, limit.x);
        const nextY = destination.cameraY + random.float(Math.random, -limit.y, limit.y);
        let nearest = Infinity;
        for (const other of placed) {
          const anchor = other.get(Anchor)!;
          nearest = Math.min(
            nearest,
            Math.hypot(nextX - anchor.x, nextY - anchor.y) -
              size.radius -
              other.get(Size)!.radius -
              motion.amplitude -
              other.get(Float)!.amplitude
          );
        }
        if (nearest > clearance) {
          x = nextX;
          y = nextY;
          clearance = nearest;
        }
      }

      entity.add(Anchor({ x, y, z }));
    });

  world
    .query(Package, Size, Anchor, Float, Not(Hidden))
    .useStores(([pkg, size, anchor, motion], entities) => {
      for (let i = 0; i < entities.length; i++) {
        const a = entities[i].id();
        for (let j = i + 1; j < entities.length; j++) {
          const b = entities[j].id();

          const dx = anchor.x[b] - anchor.x[a];
          const dy = anchor.y[b] - anchor.y[a];
          const minDist =
            size.radius[a] + size.radius[b] + motion.amplitude[a] + motion.amplitude[b] + 0.25;
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
        const limit = limits(
          anchor.z[id],
          size.radius[id],
          motion.amplitude[id],
          pkg.label[id] || pkg.name[id]
        );
        anchor.x[id] = Math.max(
          destination.cameraX - limit.x,
          Math.min(destination.cameraX + limit.x, anchor.x[id])
        );
        anchor.y[id] = Math.max(
          destination.cameraY - limit.y,
          Math.min(destination.cameraY + limit.y, anchor.y[id])
        );
      }
    });
}
