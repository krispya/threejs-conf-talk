import { useActions } from 'koota/react';
import { useEffect } from 'react';
import { packages } from '../data/packages.js';
import { actions, radiusForDownloads, timelineActions } from '../sim/index.js';

const WORD = 'PMNDRS';

export function Startup() {
  const { createCamera, createLetter, createPackage } = useActions(actions);
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
    const timeline = start();

    return () => {
      stop();
      timeline.destroy();
      for (const entity of [camera, ...letters, ...blobs]) entity.destroy();
    };
  }, [createCamera, createLetter, createPackage, start, stop]);

  return null;
}
