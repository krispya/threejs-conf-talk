import { useEffect, useMemo } from 'react';
import { uniform } from 'three/tsl';
import { Showreel } from '../traits.js';
import { useSpawnedParts } from '../../view/hooks.js';
import { createShowreelMotion } from './motion.js';
import { createShowreelSource, disposeShowreel, mountShowreel } from './source.js';

/** Own the video wall's media and uniforms. `composeShowreel` steps and renders them each frame. */
export function useShowreel() {
  const reel = useMemo(
    () => ({
      source: createShowreelSource(),
      motion: createShowreelMotion(),
      opacity: uniform(0),
      blackout: uniform(0),
    }),
    []
  );
  useEffect(() => {
    mountShowreel(reel.source);
    return () => disposeShowreel(reel.source);
  }, [reel]);
  useSpawnedParts(Showreel, reel);
  return reel;
}
