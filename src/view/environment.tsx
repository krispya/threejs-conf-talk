import { useMutableCallback, useLoader, useThree } from '@react-three/fiber/webgpu';
import { useLayoutEffect } from 'react';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { CubeUVReflectionMapping } from 'three/webgpu';

useLoader.preload(EXRLoader, './sky/environment.exr');

/** Load the prefiltered studio lighting and bind it to the scene. */
export function Environment({ intensity = 1 }: { intensity?: number }) {
  const get = useThree((state) => state.get);
  const scene = useThree((state) => state.scene);
  const environment = useLoader(EXRLoader, './sky/environment.exr');
  const environmentRef = useMutableCallback(environment);

  // The loader owns the texture, while the effect owns its scene binding.
  useLayoutEffect(() => {
    const { scene } = get();
    const environment = environmentRef.current;
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    environment.mapping = CubeUVReflectionMapping;
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
    };
  }, [get, scene, environment, environmentRef, intensity]);

  return null;
}
