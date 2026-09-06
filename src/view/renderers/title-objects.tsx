import { useFrame } from '@react-three/fiber/webgpu';
import { lerp } from 'math';
import { useMemo, useRef, useState } from 'react';
import { color, mix, normalLocal, positionWorld, smoothstep } from 'three/tsl';
import { Euler, Matrix4, Vector3, type InstancedMesh } from 'three/webgpu';
import type { useTransitionOpacity } from '../use-transition-opacity.js';
import type { useTitleFlight } from '../use-title-flight.js';

/** Solids cross the title plane with exaggerated growth as they approach the viewer. */
export function TitleObjects({
  opacity,
  depth,
  flight,
}: {
  opacity: ReturnType<typeof useTransitionOpacity>;
  depth: number;
  flight: ReturnType<typeof useTitleFlight>['motion'];
}) {
  const shapes = useRef<InstancedMesh>(null);
  const [objects] = useState(() =>
    Array.from({ length: 28 }, (_, index) => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.1 + Math.random() * 0.65,
      phase: (index + Math.random()) / 28,
      speed: 0.004 + Math.random() * 0.0025,
      size: 0.6 + Math.random() * 0.55,
      drift: 0.035 + Math.random() * 0.035,
      spinX: (0.055 + Math.random() * 0.035) * (index % 2 ? -1 : 1),
      spinY: (0.045 + Math.random() * 0.035) * (index % 3 ? 1 : -1),
      spinZ: (0.025 + Math.random() * 0.025) * (index % 4 < 2 ? -1 : 1),
    }))
  );
  const [transform] = useState(() => ({
    matrix: new Matrix4(),
    rotation: new Euler(),
    scale: new Vector3(),
    origin: new Vector3(0, 0, depth),
  }));
  const material = useMemo(
    () => ({
      color: mix(
        color('#080808'),
        color('#ffffff'),
        smoothstep(0.18, 0.2, normalLocal.y.add(normalLocal.x.mul(0.45)))
      ),
      opacity: opacity.mul(smoothstep(depth, depth + 30, positionWorld.z)),
    }),
    [opacity, depth]
  );

  useFrame(
    (state) => {
      const mesh = shapes.current;
      if (!mesh || opacity.value === 0) return;
      transform.origin.setZ(depth);
      const { width, height } = state.viewport.getCurrentViewport(state.camera, transform.origin);
      objects.forEach((object, index) => {
        const travel = (object.phase + flight.current.time * object.speed) % 1;
        const drift = state.elapsed * object.drift;
        const phase = object.phase * Math.PI * 2;
        transform.rotation.set(
          state.elapsed * object.spinX + phase,
          state.elapsed * object.spinY + phase * 0.7,
          state.elapsed * object.spinZ + phase * 1.3
        );
        // Keep distant objects tiny and amplify their size as they pass the camera.
        transform.scale.setScalar(object.size * lerp(1, 18, travel ** 3));
        transform.matrix.makeRotationFromEuler(transform.rotation).scale(transform.scale);
        transform.matrix.setPosition(
          (Math.cos(object.angle) * object.radius * width) / 2 + Math.sin(drift + phase) * 0.8,
          (Math.sin(object.angle) * object.radius * height) / 2 + Math.cos(drift * 0.7 + phase) * 0.6,
          lerp(depth, state.camera.position.z + 16, travel)
        );
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    { priority: -0.6 }
  );

  return (
    <group name="title-objects">
      <instancedMesh
        ref={shapes}
        name="title-dodecahedrons"
        renderOrder={-10}
        args={[undefined, undefined, objects.length]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshBasicNodeMaterial
          colorNode={material.color}
          opacityNode={material.opacity}
          transparent
          depthWrite
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
