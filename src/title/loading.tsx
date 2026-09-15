import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst } from 'koota/react';
import { useRef, useState } from 'react';
import type { Object3D } from 'three/webgpu';
import { Ref } from '../view/traits.js';
import { warmUp } from '../view/utils/warm-up.js';
import { Title } from './traits.js';

/** Reveal the opening after its mounted geometry has compiled and rendered a frame. */
export function OpeningReady({ onReady }: { onReady: () => void }) {
  const title = useQueryFirst(Title, Ref);
  const pending = useRef({ object: null as Object3D | null, compiled: false });
  const [error, setError] = useState<unknown>(null);

  useFrame(
    ({ renderer, camera, scene }) => {
      const object = title?.get(Ref);
      if (!object?.visible || !renderer.hasInitialized()) return;
      const preparation = pending.current;
      if (preparation.object === object) {
        if (preparation.compiled) onReady();
        return;
      }
      preparation.object = object;
      preparation.compiled = false;
      void warmUp(renderer, object, camera, scene)?.then(
        () => {
          if (preparation.object === object) preparation.compiled = true;
        },
        (error: unknown) => setError(error)
      );
    },
    { phase: 'finish' }
  );

  if (error) throw error;
  return null;
}
