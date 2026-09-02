import { useActions } from 'koota/react';
import { useEffect } from 'react';
import { packages } from '../data/packages.js';
import { actions, radiusForDownloads } from '../sim/index.js';

const WORD = 'PMNDRS';

export function Startup() {
  const { createLetter, createPackage } = useActions(actions);

  useEffect(() => {
    const letters = Array.from(WORD, (char, index) => createLetter(char, index));

    const counts = packages.map((pkg) => pkg.downloads);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const blobs = packages.map((pkg, index) =>
      createPackage(pkg.name, pkg.downloads, index, radiusForDownloads(pkg.downloads, min, max))
    );

    return () => {
      for (const entity of [...letters, ...blobs]) entity.destroy();
    };
  }, [createLetter, createPackage]);

  return null;
}
