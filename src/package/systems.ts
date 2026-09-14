import { Size, IsHidden, IsPresent } from '../traits.js';
import { Time } from '../time/traits.js';
import { Ref } from '../view/traits.js';
import {
  DownloadCounter,
  DownloadParts,
  FeatureChips,
  FeatureParts,
  MaintainerParts,
  Package,
  PackageParts,
  PackagePresence,
  PackageSizing,
  SizeTransition,
} from './traits.js';
import { Anchor, Float } from '../floating/traits.js';
import { Bounds, Camera } from '../camera/traits.js';
import { type Entity, type World, Not } from 'koota';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import type { Material } from 'three/webgpu';
import { getTransitionProgress } from '../timeline/timing.js';
import { ActiveScreen, Timeline, Screen, ScreenTransition } from '../timeline/traits.js';
import { random } from 'math/random';
import { arrivalSpring } from '../view/utils/spring.js';
import { placeMaintainerPortrait } from './utils/maintainer-layout.js';
import { downloadsLabel, packageLabelSize } from './utils/sizing.js';

/**
 * Advance each sphere's presence and apply it to the mounted glass, label, and chip.
 * A sphere that has finished leaving releases its view.
 */
export function animatePackages(world: World) {
  const now = world.get(Time)!.elapsed;
  const retired: Entity[] = [];
  world
    .query(Package, PackagePresence, PackageSizing, Size)
    .updateEach(([pkg, presence, sizing, size], entity) => {
      const previous = clamp(presence.value, 0, 1);
      const elapsed = now - presence.startedAt - presence.delay;
      const time = presence.duration <= 0 ? 1 : clamp(elapsed / presence.duration, 0, 1);
      const alpha = presence.spring ? arrivalSpring(time) : easing.cubicOut(time);
      // Spheres keep their size while the whole group leaves downward, then settle
      presence.value =
        presence.exit >= 0 && time < 1 ? presence.from : lerp(presence.from, presence.target, alpha);
      if (!entity.has(IsPresent)) return;

      const group = entity.get(Ref);
      const parts = entity.get(PackageParts);
      if (group && parts?.body && parts.label && parts.labelGroup && parts.chip) {
        const radius = sizing.compressed;
        const label = pkg.label || pkg.name;
        const { fontSize } = packageLabelSize(radius, label);
        group.scale.setScalar(Math.max(0.001, (presence.value * size.radius) / radius));
        // Keep labels in a readable size range while the spheres grow and shrink
        parts.labelGroup.scale.setScalar(
          (packageLabelSize(size.radius, label).fontSize * radius) / (fontSize * size.radius)
        );
        const opacity = clamp(presence.value, 0, 1);
        (parts.body.material as Material).opacity = opacity;
        parts.chip.opacity = opacity;
        if (opacity !== previous) parts.label.set({ style: { fontSize, lineHeight: 1, opacity } });
      }
      if (presence.value === 0 && presence.target === 0) {
        if (group) group.visible = false;
        retired.push(entity);
      }
    });
  for (const entity of retired) entity.remove(IsPresent);
}

/** Raise, count, and settle each download ticker above its sphere. */
export function animateDownloadCounters(world: World) {
  const now = world.get(Time)!.elapsed;
  world
    .query(Package, DownloadCounter, DownloadParts, PackagePresence, PackageSizing, Ref)
    .updateEach(([pkg, counter, parts, presence, sizing, body]) => {
      const { group, number, backdrop } = parts;
      if (!group || !number || !backdrop) return;
      if (counter.fresh) {
        number.set({ text: downloadsLabel(0) });
        group.visible = false;
        counter.fresh = false;
      }
      if (!counter.visible && counter.opacity === 0) return;

      const elapsed = now - counter.startedAt;
      const duration = counter.visible
        ? 0.6
        : Math.min(presence.exit >= 0 ? presence.exit : 0.34, 0.45);
      const progress = duration <= 0 ? 1 : clamp(elapsed / duration, 0, 1);
      if (counter.visible) {
        const settle = Math.sin(progress * Math.PI) ** 2;
        counter.y = lerp(counter.fromY, 0, easing.cubicOut(progress)) + settle * 0.08;
        counter.scale = lerp(counter.fromScale, 1, easing.cubicOut(progress)) + settle * 0.018;
        const size = sizing.compressed * body.scale.x;
        const rejoin = counter.rejoining ? easing.cubicOut(progress) : 1;
        counter.anchorX = lerp(counter.fromAnchorX, body.position.x, rejoin);
        counter.anchorY = lerp(counter.fromAnchorY, body.position.y + size + 0.25, rejoin);
        counter.anchorZ = lerp(counter.fromAnchorZ, body.position.z + size + 0.04, rejoin);
      } else {
        counter.y = counter.fromY + easing.cubicIn(progress) * (presence.exit < 0 ? 0.65 : -0.5);
        counter.scale = lerp(counter.fromScale, 0.82, easing.cubicIn(progress));
      }
      const opacity = counter.visible
        ? lerp(counter.fromOpacity, 1, easing.cubicOut(clamp(elapsed / 0.22, 0, 1)))
        : lerp(counter.fromOpacity, 0, easing.cubicIn(progress));
      group.visible = opacity > 0;
      if (opacity !== counter.opacity) {
        number.set({ style: { ...number.style, opacity } });
        backdrop.opacity = opacity;
        counter.opacity = opacity;
      }
      if (!group.visible) return;

      // Keep the ticker anchored while its exit follows the package group.
      group.scale.setScalar(counter.scale);
      group.position.set(counter.anchorX, counter.anchorY + counter.y, counter.anchorZ);

      // Update the retained glyphs at 30 Hz while the counter runs, then leave them alone.
      const countElapsed = Math.max(0, now - counter.countStartedAt);
      const tick = Math.floor(countElapsed * 30);
      if (counter.visible && tick !== counter.tick && counter.value !== pkg.downloads) {
        const value = Math.round(
          lerp(
            counter.countFrom,
            pkg.downloads,
            counter.countDuration > 0
              ? easing.cubicOut(clamp(countElapsed / counter.countDuration, 0, 1))
              : 1 - Math.exp(-countElapsed / 1.2)
          )
        );
        if (value !== counter.value) number.set({ text: downloadsLabel(value) });
        counter.tick = tick;
        counter.value = value;
      }
    });
}

/** Feature chips follow the three sphere's float and stagger in after it settles. */
export function animateFeatureChips(world: World) {
  const now = world.get(Time)!.elapsed;
  const startedAt = world.queryFirst(Timeline)?.get(Timeline)?.startedAt ?? 0;
  world
    .query(FeatureChips, FeatureParts, PackageSizing, Ref)
    .updateEach(([chips, parts, sizing, body]) => {
      if (!parts.root) return;
      const size = sizing.compressed * body.scale.x;
      parts.root.position.set(body.position.x + size + 0.4, body.position.y, body.position.z + 0.08);
      chips.items.forEach((item, index) => {
        const chip = parts.chips[index];
        const label = parts.labels[index];
        const material = parts.materials[index];
        if (!chip || !label || !material) return;
        const elapsed = now - startedAt - item.delay;
        const progress = clamp(elapsed / (chips.visible ? 0.6 : 0.24), 0, 1);
        item.value = lerp(
          item.from,
          item.target,
          chips.visible ? arrivalSpring(progress) : easing.cubicIn(progress)
        );
        const opacity = clamp(item.value, 0, 1);
        chip.visible = opacity > 0;
        if (material.opacity !== opacity) {
          material.opacity = opacity;
          label.set({ style: { ...label.style, opacity } });
        }
        chip.scale.setScalar(lerp(0.9, 1, item.value));
        chip.position.set(
          (1 - item.value) * -0.3,
          (0.5 - index) * 0.72 + Math.sin(now * 0.4 + index) * 0.035,
          0
        );
      });
    });
}

const placement = new Float32Array(4);

/** Maintainer portraits drift along their label's edges while their fade reveals them. */
export function placeMaintainerPortraits(world: World) {
  const now = world.get(Time)!.elapsed;
  world.query(Package, PackageSizing, MaintainerParts).updateEach(([pkg, sizing, parts]) => {
    const reveal = parts.opacity.value;
    const { width, fontSize } = packageLabelSize(sizing.compressed, pkg.label || pkg.name);
    const count = parts.groups.length;
    parts.groups.forEach((portrait, index) => {
      if (!portrait) return;
      portrait.visible = reveal > 0;
      if (!portrait.visible) return;
      placeMaintainerPortrait(placement, width, fontSize * 1.5, 0.22, pkg.index, index, count, now);
      portrait.visible = placement[3] > 0;
      portrait.position.set(placement[0], placement[1], placement[2]);
      portrait.scale.setScalar(placement[3] * (0.85 + reveal * 0.15));
    });
  });
}

/** Resize the same package entities using the destination screen's transition timing. */
export function resizePackages(world: World) {
  if (!world.queryFirst(Timeline)?.targetFor(ActiveScreen)) return;
  const progress = getTransitionProgress(world);

  world.query(Package, Size, SizeTransition).updateEach(([, size, transition]) => {
    size.radius = lerp(transition.from, transition.to, progress);
  });
}

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

  if (data?.packageLayout === 'pair' || data?.packageLayout === 'community') {
    const z = data.packageLayout === 'community' ? destination.cameraZ - 7.5 : 1.4;
    const packages = [...world.query(Package, Size, Float, Not(IsHidden))].sort(
      (a, b) =>
        data.packageNames.indexOf(a.get(Package)!.name) -
        data.packageNames.indexOf(b.get(Package)!.name)
    );
    const radii = packages.map((entity) => entity.get(Size)!.radius + entity.get(Float)!.amplitude);
    let cursor = -radii.reduce((sum, radius) => sum + radius, 0) - (packages.length - 1) * 0.2;
    packages.forEach((entity, index) => {
      const pkg = entity.get(Package)!;
      const limit = limits(
        z,
        entity.get(Size)!.radius,
        entity.get(Float)!.amplitude,
        pkg.label || pkg.name
      );
      const x = cursor + radii[index];
      cursor += radii[index] * 2 + 0.4;
      const anchor = {
        x: destination.cameraX + Math.max(-limit.x, Math.min(limit.x, x)),
        y: destination.cameraY,
        z,
      };
      if (entity.has(Anchor)) entity.set(Anchor, anchor);
      else entity.add(Anchor(anchor));
    });
    return;
  }

  // The overview keeps packages in front of the letters
  world.query(Package, Anchor, Not(IsHidden)).updateEach(([, anchor]) => {
    if (anchor.z < 0) anchor.z = 1.4;
  });

  world
    .query(Package, Size, Float, Not(Anchor), Not(IsHidden))
    .updateEach(([pkg, size, motion], entity) => {
      const z = random.float(Math.random, 1.2, 1.5);
      const limit = limits(z, size.radius, motion.amplitude, pkg.label || pkg.name);
      const placed = world.query(Package, Size, Float, Anchor, Not(IsHidden));
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
    .query(Package, Size, Anchor, Float, Not(IsHidden))
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
