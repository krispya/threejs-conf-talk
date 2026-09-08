import { useFrame } from '@react-three/fiber/webgpu';
import { useMemo, useRef, useState } from 'react';
import { float, smoothstep, uv } from 'three/tsl';
import { DynamicDrawUsage, Vector3, type InstancedMesh } from 'three/webgpu';
import { createTitleTrails, updateTitleTrails } from '../title-trails.js';
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
  const [trails] = useState(() => createTitleTrails(480));
  const [origin] = useState(() => new Vector3(0, 0, depth));
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
      origin.setZ(depth);
      const { width, height } = state.viewport.getCurrentViewport(state.camera, origin);
      updateTitleTrails(
        trails,
        flight.current.time,
        flight.current.boost,
        width,
        height,
        state.size.height,
        depth,
        portal.radius.value
      );
      mesh.current.count = trails.count;
      mesh.current.instanceMatrix.needsUpdate = true;
    },
    { priority: -0.6 }
  );

  return (
    <instancedMesh
      ref={mesh}
      name="title-travel"
      renderOrder={-10}
      args={[undefined, undefined, trails.capacity]}
      frustumCulled={false}
      visible={false}
    >
      <instancedBufferAttribute
        attach="instanceMatrix"
        args={[trails.matrices, 16]}
        usage={DynamicDrawUsage}
      />
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
