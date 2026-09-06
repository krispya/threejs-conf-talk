import { useActions } from 'koota/react';
import { random } from 'math/random';
import { useEffect } from 'react';
import { packages } from '../data/packages.js';
import { profiles } from '../data/profiles.js';
import {
  actions,
  compressedRadiusForDownloads,
  radiusForDownloads,
  timelineActions,
} from '../sim/index.js';

const WORD = 'PMNDRS';

export function Startup() {
  const {
    createCamera,
    createTitle,
    createCharter,
    createInitiatives,
    createLetter,
    createPackage,
    createProfile,
    createPrinciplesConstellation,
  } = useActions(actions);
  const { start, stop } = useActions(timelineActions);

  useEffect(() => {
    const camera = createCamera();
    const title = createTitle();
    const charter = createCharter();
    const initiatives = createInitiatives();
    const principles = createPrinciplesConstellation();
    const letters = Array.from(WORD, (char, index) => createLetter(char, index));

    const max = Math.max(...packages.map((pkg) => pkg.downloads));
    const min = Math.min(...packages.map((pkg) => pkg.downloads));
    const blobs = packages.map((pkg, index) =>
      createPackage(
        pkg.name,
        pkg.downloads,
        index,
        compressedRadiusForDownloads(pkg.downloads, min, max),
        radiusForDownloads(pkg.downloads, max)
      )
    );
    // Shuffle depth slots independently of the portrait layout
    const depths = profiles.map((_, index) => index);
    const portraits = profiles.map((profile, index) => {
      const [depth] = depths.splice(random.int(Math.random, 0, depths.length - 1), 1);
      return createProfile(profile.login, profile.avatar, index, depth);
    });
    const timeline = start();

    return () => {
      stop();
      timeline.destroy();
      for (const entity of [
        camera,
        title,
        charter,
        principles,
        ...letters,
        ...blobs,
        ...portraits,
        ...initiatives,
      ])
        entity.destroy();
    };
  }, [
    createCamera,
    createTitle,
    createCharter,
    createInitiatives,
    createLetter,
    createPackage,
    createProfile,
    createPrinciplesConstellation,
    start,
    stop,
  ]);

  return null;
}
