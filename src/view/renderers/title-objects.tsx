import { useFrame } from '@react-three/fiber/webgpu';
import { lerp } from 'math';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { color, mix, normalLocal, positionWorld, smoothstep } from 'three/tsl';
import { Euler, Matrix4, Vector3, type InstancedMesh } from 'three/webgpu';
import type { useTransitionOpacity } from '../use-transition-opacity.js';
import type { useTitleFlight } from '../use-title-flight.js';
import type { usePortal } from '../use-portal.js';

/** Solids cross the title plane with exaggerated growth as they approach the viewer. */
export function TitleObjects({
  opacity,
  depth,
  flight,
  restart,
  portal,
}: {
  opacity: ReturnType<typeof useTransitionOpacity>;
  depth: number;
  flight: ReturnType<typeof useTitleFlight>['motion'];
  restart: boolean;
  portal: ReturnType<typeof usePortal>;
}) {
  const shapes = useRef<InstancedMesh>(null);
  const emissionStart = useRef<number | null>(null);
  const rotationTime = useRef(0);
  const [objects] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.1 + Math.random() * 0.65,
      phase: (index + Math.random()) / 12,
      speed: 0.004 + Math.random() * 0.0025,
      size: 0.6 + Math.random() * 0.55,
      drift: 0.035 + Math.random() * 0.035,
      spinX: (0.1 + Math.random() * 0.08) * (index % 2 ? -1 : 1),
      spinY: (0.08 + Math.random() * 0.06) * (index % 3 ? 1 : -1),
      spinZ: (0.05 + Math.random() * 0.05) * (index % 4 < 2 ? -1 : 1),
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
      opacity: opacity.mul(smoothstep(depth, depth + 30, positionWorld.z)).mul(portal.outside),
    }),
    [opacity, depth, portal.outside]
  );

  useLayoutEffect(() => {
    if (restart) emissionStart.current = flight.current.time;
  }, [restart, flight]);

  useFrame(
    (state, delta) => {
      const mesh = shapes.current;
      if (!mesh) return;
      const presence = Math.min(1, flight.current.boost);
      mesh.visible = opacity.value > 0 && presence > 0 && portal.progress.value < 1;
      if (!mesh.visible) {
        if (!restart) emissionStart.current = null;
        return;
      }
      emissionStart.current ??= flight.current.time;
      // Keep the tumble slow even when forward travel accelerates
      rotationTime.current += delta;
      transform.origin.setZ(depth);
      const { width, height } = state.viewport.getCurrentViewport(state.camera, transform.origin);
      objects.forEach((object, index) => {
        // A fresh stream staggers births at the far plane before recycling passed debris.
        const age =
          (flight.current.time - emissionStart.current!) * object.speed * 1.25 - object.phase * 0.15;
        const travel = age < 0 ? 0 : age % 1;
        const drift = (flight.current.time / 8) * object.drift;
        const phase = object.phase * Math.PI * 2;
        transform.rotation.set(
          rotationTime.current * object.spinX + phase,
          rotationTime.current * object.spinY + phase * 0.7,
          rotationTime.current * object.spinZ + phase * 1.3
        );
        // Keep distant objects tiny and amplify their size as they pass the camera.
        transform.scale.setScalar(age < 0 ? 0 : object.size * lerp(1, 18, travel ** 3) * presence);
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
        visible={false}
      >
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshBasicNodeMaterial
          colorNode={material.color}
          opacityNode={material.opacity}
          maskNode={portal.mask}
          transparent
          depthWrite
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
