import { useThree } from '@react-three/fiber/webgpu';
import { useEffect } from 'react';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PMREMGenerator } from 'three/webgpu';

/** Offline studio-style environment map so glass has something to reflect. */
export function Environment({ intensity = 1 }: { intensity?: number }) {
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);

  // Scene mutation is the whole point of this effect
  /* oxlint-disable react/immutability */
  useEffect(() => {
    const generator = new PMREMGenerator(renderer);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    generator.dispose();

    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [renderer, scene, intensity]);
  /* oxlint-enable react/immutability */

  return null;
}
