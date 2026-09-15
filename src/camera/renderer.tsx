import { Position, Rotation } from '../traits.js';
import { useQuery, useTrait } from 'koota/react';
import { Camera } from './traits.js';
import { useViewBinding } from '../view/hooks.js';
import { useThree } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useLayoutEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';

export function CameraRenderer() {
  const cameras = useQuery(Camera, Position, Rotation);

  return cameras.map((entity) => <CameraView key={entity} entity={entity} />);
}

function CameraView({ entity }: { entity: Entity }) {
  const { fov, near, far } = useTrait(entity, Camera)!;
  const get = useThree((state) => state.get);
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const cameraRef = useRef<PerspectiveCamera | null>(null);

  const bindView = useViewBinding(entity);
  const handleInit = (camera: PerspectiveCamera | null) => {
    if (!camera) return;
    cameraRef.current = camera;
    const previousCamera = get().camera;
    const position = entity.get(Position)!;
    const rotation = entity.get(Rotation)!;
    camera.position.set(position.x, position.y, position.z);
    camera.rotation.set(rotation.x, rotation.y, rotation.z);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const release = bindView(camera);
    set({ camera });

    return () => {
      cameraRef.current = null;
      release?.();
      if (get().camera === camera) set({ camera: previousCamera });
    };
  };

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    camera.updateProjectionMatrix();
    if (get().camera === camera) {
      set((state) => ({
        viewport: { ...state.viewport, ...state.viewport.getCurrentViewport(camera) },
      }));
    }
  }, [fov, near, far, size.width, size.height, get, set]);

  return (
    <perspectiveCamera
      ref={handleInit}
      fov={fov}
      near={near}
      far={far}
      aspect={size.width / size.height}
    />
  );
}
