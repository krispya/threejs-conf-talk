import { IsHidden } from '../traits.js';
import { Size, Position, Rotation } from '../traits.js';
import { SizeTransition, Package, PackageSizing } from './traits.js';
import { Float } from '../floating/traits.js';
import { createActions } from 'koota';

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
    return world.spawn(
      Package({ name, label, downloads, index }),
      PackageSizing({ compressed: radius, proportional: proportionalRadius }),
      Size({ radius }),
      SizeTransition({ from: radius, to: radius }),
      Position,
      Rotation,
      Float({
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.25,
        amplitude: 0.15 + Math.random() * 0.15,
        tilt: 0,
      })
    );
  };
  return {
    setPackagePresentation: ({
      packagesVisible,
      packageNames,
      packageSizing,
    }: {
      packagesVisible: boolean;
      packageNames: readonly string[];
      packageSizing: 'compressed' | 'proportional';
    }) => {
      world.query(PackageSizing, Size, SizeTransition).updateEach(([sizing, size, transition]) => {
        transition.from = size.radius;
        transition.to = sizing[packageSizing];
      });
      for (const entity of world.query(Package)) {
        if (
          packagesVisible &&
          (packageNames.length === 0 || packageNames.includes(entity.get(Package)!.name))
        )
          entity.remove(IsHidden);
        else entity.add(IsHidden);
      }
    },

    setPackagesVisible: (visible: boolean) => {
      for (const entity of world.query(Package)) {
        if (visible) entity.remove(IsHidden);
        else entity.add(IsHidden);
      }
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
