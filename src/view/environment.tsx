import { useLoader, useThree } from '@react-three/fiber/webgpu';
import { useLayoutEffect } from 'react';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { CubeUVReflectionMapping } from 'three/webgpu';

useLoader.preload(EXRLoader, './sky/environment.exr');

/** Load the prefiltered studio lighting and bind it to the scene. */
export function Environment({ intensity = 1 }: { intensity?: number }) {
  const scene = useThree((state) => state.scene);
  const environment = useLoader(EXRLoader, './sky/environment.exr');

  // The loader owns the texture, while the effect owns its scene binding.
  /* oxlint-disable react/immutability */
  useLayoutEffect(() => {
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    environment.mapping = CubeUVReflectionMapping;
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
    };
  }, [scene, environment, intensity]);
  /* oxlint-enable react/immutability */

  return null;
}
