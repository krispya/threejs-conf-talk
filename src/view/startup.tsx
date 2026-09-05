import { useActions } from 'koota/react';
import { random } from 'math/random';
import { useEffect } from 'react';
import { packages } from '../data/packages.js';
import { profiles } from '../data/profiles.js';
import { actions, radiusForDownloads, timelineActions } from '../sim/index.js';

const WORD = 'PMNDRS';

export function Startup() {
  const { createCamera, createLetter, createPackage, createProfile } = useActions(actions);
  const { start, stop } = useActions(timelineActions);

  useEffect(() => {
    const camera = createCamera();
    const letters = Array.from(WORD, (char, index) => createLetter(char, index));

    const counts = packages.map((pkg) => pkg.downloads);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const blobs = packages.map((pkg, index) =>
      createPackage(pkg.name, pkg.downloads, index, radiusForDownloads(pkg.downloads, min, max))
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
      for (const entity of [camera, ...letters, ...blobs, ...portraits]) entity.destroy();
    };
  }, [createCamera, createLetter, createPackage, createProfile, start, stop]);

  return null;
}
