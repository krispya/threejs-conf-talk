import { useFrame } from '@react-three/fiber/webgpu';
import { clamp } from 'math';
import { useMemo, useRef, useState } from 'react';
import { float, smoothstep, uv } from 'three/tsl';
import { Matrix4, Vector3, type InstancedMesh } from 'three/webgpu';
import type { useTransitionOpacity } from '../use-transition-opacity.js';
import type { useTitleFlight } from '../use-title-flight.js';
import type { usePortal } from '../use-portal.js';

/** Radial trails pass behind the title so the solid faces interrupt the warp field. */
export function TitleTravel({
  opacity,
  depth,
  flight,
  portal,
}: {
  opacity: ReturnType<typeof useTransitionOpacity>;
  depth: number;
  flight: ReturnType<typeof useTitleFlight>['motion'];
  portal: ReturnType<typeof usePortal>;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const [particles] = useState(() =>
    Array.from({ length: 480 }, () => ({
      angle: Math.random() * Math.PI * 2,
      phase: Math.random(),
      speed: 0.022 + Math.random() * 0.01,
      trail: 0.1 + Math.random() * 0.08,
      width: 2.2 + Math.random() * 1.8,
    }))
  );
  const [transform] = useState(() => ({
    matrix: new Matrix4(),
    scale: new Vector3(),
    origin: new Vector3(0, 0, depth),
  }));
  const softness = useMemo(() => {
    const across = uv().y.sub(0.5).mul(2).abs();
    const core = float(1).sub(smoothstep(0.2, 1, across));
    const trail = smoothstep(0, 0.9, uv().x).mul(float(1).sub(smoothstep(0.92, 1, uv().x)));
    return core.mul(trail).mul(opacity).mul(portal.outside).mul(0.7);
  }, [opacity, portal.outside]);

  useFrame(
    (state) => {
      if (!mesh.current) return;
      mesh.current.visible =
        opacity.value > 0 && flight.current.boost > 0 && portal.progress.value < 1;
      if (!mesh.current.visible) return;
      transform.origin.setZ(depth);
      const { width, height } = state.viewport.getCurrentViewport(state.camera, transform.origin);
      particles.forEach((particle, index) => {
        const travel = (particle.phase + flight.current.time * particle.speed) % 1;
        const density =
          index < 96
            ? clamp(flight.current.boost, 0, 1)
            : index < 288
              ? clamp(flight.current.boost * 2 - (index - 96) / 192, 0, 1)
              : clamp((flight.current.boost - 1) / 3, 0, 1);
        // Emit outward from the portal rim as the opening approaches the camera
        const source =
          portal.radius.value /
          Math.hypot(Math.cos(particle.angle) * (width / height), Math.sin(particle.angle));
        const head = source + 0.035 * Math.exp(travel * 4.6);
        const tail =
          source +
          0.035 * Math.exp((travel - particle.trail * (1 + flight.current.boost * 0.35)) * 4.6);
        const x = (Math.cos(particle.angle) * width) / 2;
        const y = (Math.sin(particle.angle) * height) / 2;
        const thickness = (height / state.size.height) * particle.width * (0.65 + head * 0.6);
        transform.scale.set(
          Math.hypot(x, y) * (head - tail),
          thickness * clamp(travel / 0.12, 0, 1) * density,
          1
        );
        transform.matrix.makeRotationZ(Math.atan2(y, x)).scale(transform.scale);
        transform.matrix.setPosition(
          (x * (head + tail)) / 2,
          (y * (head + tail)) / 2,
          transform.origin.z
        );
        mesh.current!.setMatrixAt(index, transform.matrix);
      });
      mesh.current.instanceMatrix.needsUpdate = true;
    },
    { priority: -0.6 }
  );

  return (
    <instancedMesh
      ref={mesh}
      name="title-travel"
      renderOrder={-10}
      args={[undefined, undefined, particles.length]}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        color="#ffffff"
        opacityNode={softness}
        maskNode={portal.mask}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
