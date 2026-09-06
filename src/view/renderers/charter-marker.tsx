import { useFrame } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useMemo, useRef } from 'react';
import { float, hash, smoothstep, uv, vec2 } from 'three/tsl';
import { Vector2, type Group, type Node } from 'three/webgpu';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

/** A retained ink ribbon reveals along its length, following the paper's lower fold. */
export function CharterMarker({ opacity }: { opacity: Node<'float'> }) {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const progress = useTransitionOpacity(
    !!data?.charterVisible && data.charterHighlight === 'initiatives'
  );
  const group = useRef<Group>(null);
  const stroke = useMemo(() => {
    const points = Array.from({ length: 161 }, (_, index) => {
      const t = index / 160;
      const angle = 2.45 - t * (Math.PI * 2 + 0.33);
      return new Vector2(
        Math.cos(angle) * 4.65 + Math.sin(angle * 3) * 0.09 + t * 0.12,
        Math.sin(angle) * 0.85 + Math.cos(angle * 4) * 0.04 - t * 0.06
      );
    });
    const distances = points.map(() => 0);
    for (let i = 1; i < points.length; i++) {
      distances[i] = distances[i - 1] + points[i].distanceTo(points[i - 1]);
    }
    const positions = new Float32Array(points.length * 6);
    const uvs = new Float32Array(points.length * 4);
    const indices = new Uint16Array((points.length - 1) * 6);

    for (const [i, point] of points.entries()) {
      const before = points[Math.max(0, i - 1)];
      const after = points[Math.min(points.length - 1, i + 1)];
      const tangent = after.clone().sub(before).normalize();
      const halfWidth = 0.095 * (1 + Math.sin(i * 0.12) * 0.16 + Math.cos(i * 0.29) * 0.08);
      positions.set(
        [
          point.x - tangent.y * halfWidth,
          point.y + tangent.x * halfWidth,
          0,
          point.x + tangent.y * halfWidth,
          point.y - tangent.x * halfWidth,
          0,
        ],
        i * 6
      );
      const distance = distances[i] / distances[distances.length - 1];
      uvs.set([distance, 0, distance, 1], i * 4);
      if (i < points.length - 1) {
        const a = i * 2;
        indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
      }
    }
    return { positions, uvs, indices };
  }, []);
  const ink = useMemo(() => {
    const point = uv();
    const drawn = progress.pow(3);
    const tip = float(1).sub(smoothstep(drawn.sub(0.008), drawn, point.x));
    const edge = smoothstep(0, 0.18, point.y).mul(smoothstep(0, 0.18, point.y.oneMinus()));
    const fibers = hash(point.mul(vec2(350, 8)).floor().dot(vec2(1, 4096)).toInt())
      .mul(0.13)
      .add(0.87);
    return tip.mul(edge).mul(fibers).mul(opacity).mul(0.86);
  }, [progress, opacity]);

  useFrame(
    () => {
      if (group.current) group.current.visible = progress.value > 0;
    },
    { priority: -0.6 }
  );

  return (
    <group ref={group} name="charter-initiatives-marker" position={[-14, 4.1, 0.16]} visible={false}>
      <mesh renderOrder={7}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stroke.positions, 3]} />
          <bufferAttribute attach="attributes-uv" args={[stroke.uvs, 2]} />
          <bufferAttribute attach="index" args={[stroke.indices, 1]} />
        </bufferGeometry>
        <meshBasicNodeMaterial
          color="#c52b32"
          opacityNode={ink}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
