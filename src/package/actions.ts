import { IsHidden, IsPresent } from '../traits.js';
import { Size, Position, Rotation } from '../traits.js';
import { Time } from '../time/traits.js';
import { Timeline, type Screen } from '../timeline/traits.js';
import {
  DownloadCounter,
  FeatureChips,
  Package,
  PackagePresence,
  PackageSizing,
  SizeTransition,
} from './traits.js';
import { Float } from '../floating/traits.js';
import { createActions, type Entity, type ExtractSchema, type TraitRecord } from 'koota';

import { packages } from './data.js';
import { compressedRadiusForDownloads, radiusForDownloads } from './utils/sizing.js';

export const packageActions = createActions((world) => {
  const createPackage = (
    name: string,
    downloads: number,
    index: number,
    radius: number,
    proportionalRadius = radius,
    label = name
  ) => {
    const entity = world.spawn(
      Package({ name, label, downloads, index }),
      PackageSizing({ compressed: radius, proportional: proportionalRadius }),
      Size({ radius }),
      SizeTransition({ from: radius, to: radius }),
      PackagePresence,
      DownloadCounter,
      Position,
      Rotation,
      Float({
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.25,
        amplitude: 0.15 + Math.random() * 0.15,
        tilt: 0,
      })
    );
    if (name === 'three') entity.add(FeatureChips);
    return entity;
  };
  const show = (entity: Entity, visible: boolean) => {
    if (visible) {
      entity.remove(IsHidden);
      if (!entity.has(IsPresent)) entity.add(IsPresent);
    } else entity.add(IsHidden);
  };
  return {
    finishPackageExit: (entity: Entity) => {
      if (!entity.isAlive()) return;
      const presence = entity.get(PackagePresence);
      if (presence?.target === 0 && presence.value === 0) entity.remove(IsPresent);
    },
    /** Capture every package transition for the screen being entered. */
    setPackagePresentation: (screen: TraitRecord<ExtractSchema<typeof Screen>>) => {
      const timing = world.queryFirst(Timeline)?.get(Timeline);
      const now = world.get(Time)!.elapsed;
      const startedAt = timing?.startedAt ?? now;
      const duration = timing?.duration ?? 0;
      const names = screen.packageNames;
      const count = names.length || world.query(Package).length;
      const leavingDown = screen.codeComparisonVisible || screen.warpVisible || screen.teamVisible;
      const exit = leavingDown ? Math.min(screen.warpVisible ? 0.65 : 0.9, duration) : -1;

      world.query(PackageSizing, Size, SizeTransition).updateEach(([sizing, size, transition]) => {
        transition.from = size.radius;
        transition.to = sizing[screen.packageSizing];
      });

      for (const entity of world.query(Package)) {
        const pkg = entity.get(Package)!;
        const visible = screen.packagesVisible && (names.length === 0 || names.includes(pkg.name));
        show(entity, visible);

        const presence = entity.get(PackagePresence);
        if (presence) {
          const entering = visible && presence.value === 0;
          const returning = visible && screen.packageEntry === 'rise';
          const delay = entering ? screen.packageDelay : 0;
          const stagger = entering
            ? Math.min(screen.packageStagger, duration / Math.max(1, count))
            : 0;
          entity.set(PackagePresence, {
            from: returning ? 1 : presence.value,
            target: visible ? 1 : 0,
            startedAt,
            delay:
              delay + (names.length ? Math.max(0, names.indexOf(pkg.name)) : pkg.index) * stagger,
            // The final package settles before the shared screen transition finishes.
            duration: returning
              ? 0
              : exit >= 0
                ? exit
                : !visible && presence.community
                  ? 0.3
                  : screen.packageDuration || duration - delay - Math.max(0, count - 1) * stagger,
            spring:
              visible && (screen.packageLayout === 'pair' || screen.packageLayout === 'community'),
            community: visible ? screen.packageLayout === 'community' : presence.community,
            exit,
          });
        }

        const counter = entity.get(DownloadCounter);
        if (counter) {
          const showing = visible && screen.packageDownloadsVisible;
          const fresh = showing && counter.opacity === 0;
          const stagger = fresh
            ? Math.max(0, names.indexOf(pkg.name)) * screen.packageStagger
            : counter.stagger;
          const y = fresh ? -0.42 : counter.y;
          const scale = fresh ? 0.92 : counter.scale;
          const value = fresh ? 0 : counter.value;
          const counterStart = fresh
            ? startedAt + screen.packageDelay + Math.min(0.24, duration * 0.25) + stagger
            : exit >= 0
              ? startedAt
              : now + (showing ? 0 : stagger * 0.5);
          entity.set(DownloadCounter, {
            visible: showing,
            fresh,
            stagger,
            y,
            scale,
            value,
            fromOpacity: counter.opacity,
            fromY: y,
            fromScale: scale,
            fromAnchorX: counter.anchorX,
            fromAnchorY: counter.anchorY,
            fromAnchorZ: counter.anchorZ,
            rejoining: showing && !fresh,
            startedAt: counterStart,
            // Advancing to the robot keeps the same counter running from its original start
            ...(showing && !counter.counting
              ? {
                  countStartedAt: counterStart,
                  countDuration: screen.packageLayout === 'community' ? 3.2 : 0,
                  countFrom: Math.max(0, value),
                  tick: -1,
                }
              : {}),
            counting: showing,
          });
        }

        const chips = entity.get(FeatureChips);
        if (chips) {
          chips.visible = visible && screen.packageFeaturesVisible;
          chips.items.forEach((item, index) => {
            item.from = item.value;
            item.target = chips.visible ? 1 : 0;
            item.delay =
              chips.visible && item.value === 0
                ? screen.packageDelay + screen.packageDuration + 0.12 + index * 0.22
                : 0;
          });
        }
      }
    },

    setPackagesVisible: (visible: boolean) => {
      for (const entity of world.query(Package)) show(entity, visible);
    },
    createPackage,
    createPackages: () => {
      const max = Math.max(...packages.map((pkg) => pkg.downloads));
      const min = Math.min(...packages.map((pkg) => pkg.downloads));
      return packages.map((pkg, index) =>
        createPackage(
          pkg.name,
          pkg.downloads,
          index,
          compressedRadiusForDownloads(pkg.downloads, min, max),
          radiusForDownloads(pkg.downloads, max)
        )
      );
    },
  };
});
