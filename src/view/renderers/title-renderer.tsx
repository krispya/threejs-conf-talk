import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useTrait } from 'koota/react';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {
  cameraProjectionMatrix,
  color,
  float,
  modelViewMatrix,
  positionLocal,
  smoothstep,
  uv,
  vec4,
} from 'three/tsl';
import { BufferGeometry, Float32BufferAttribute, Vector3, type Group, type Mesh } from 'three/webgpu';
import { Hidden, Position, Ref, Title } from '../../sim/index.js';
import { brand, fonts } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { useTitleFlight } from '../use-title-flight.js';
import { usePortal } from '../use-portal.js';
import { EXCLUDE_FROM_BACKDROP } from '../glass/transmission-backdrop.js';
import { TitleTravel } from './title-travel.js';
import { TitleObjects } from './title-objects.js';
import { RobotReveal } from './robot-reveal.js';

useLoader.preload(FontLoader, fonts.geometry);

export function TitleRenderer() {
  const titles = useQuery(Title, Position);
  return titles.map((entity) => <TitleView key={entity} entity={entity} />);
}

function TitleView({ entity }: { entity: Entity }) {
  const font = useLoader(FontLoader, fonts.geometry);
  const { text } = useTrait(entity, Title)!;
  const visible = !useHas(entity, Hidden);
  const opacity = useTransitionOpacity(visible);
  const { motion, scrim, speed, scenery, robotVisible, warpVisible } = useTitleFlight();
  const portal = usePortal();
  const flightOpacity = useTransitionOpacity(visible && !robotVisible, {
    duration: warpVisible || !visible ? 0.28 : undefined,
  });
  const objectOpacity = useTransitionOpacity(visible && !robotVisible, {
    duration: warpVisible ? 0 : !visible ? 0.28 : undefined,
  });
  const letterOpacity = useTransitionOpacity(visible && !robotVisible, {
    duration: warpVisible || !visible ? 0.28 : undefined,
    delay: warpVisible ? 1.05 : 0,
  });
  const scrimMesh = useRef<Mesh>(null);
  const lettering = useRef<Group>(null);
  const mark = useRef<Group>(null);
  const approach = useRef({ visible: false, time: 0 });
  const horizon = useMemo(() => new Vector3(0, 0, -300), []);
  const wireMaterial = useMemo(() => {
    // Exponential depth growth starts at the letter faces and accelerates toward infinity
    const extension = speed.clamp().mul(Math.log(10001)).exp().sub(1).div(10000);
    const depth = positionLocal.z.mul(extension);
    const projected = cameraProjectionMatrix
      .mul(modelViewMatrix)
      .mul(vec4(positionLocal.xy, depth, 1));
    return {
      // Preserve perspective at arbitrary depths without clipping at the scene's far plane.
      vertex: vec4(projected.xy, projected.w.mul(0.99999), projected.w),
      opacity: depth
        .negate()
        .div(12)
        .add(1)
        .pow(-0.6)
        .mul(letterOpacity)
        .mul(speed.mul(8).clamp())
        .mul(portal.outside)
        .mul(0.65),
      faceOpacity: letterOpacity.mul(portal.outside),
    };
  }, [letterOpacity, portal.outside, speed]);
  const lines = useMemo(
    () =>
      text.split('\n').map((line) => {
        const shapes = font.generateShapes(line, 1);
        const vertices: number[] = [];
        // Smooth contour rings and spaced depth rails keep the extrusion legible.
        for (const shape of shapes) {
          for (const path of [shape, ...shape.holes]) {
            const contour = path.getPoints(12);
            for (const z of [0, -0.6, -1.8, -5.4, -16.2, -48.6, -145.8]) {
              for (let i = 0; i < contour.length; i++) {
                const a = contour[i];
                const b = contour[(i + 1) % contour.length];
                vertices.push(a.x, a.y, z, b.x, b.y, z);
              }
            }
            for (const point of path.getSpacedPoints(
              Math.max(4, Math.ceil(path.getLength() / 0.28))
            )) {
              vertices.push(point.x, point.y, 0, point.x, point.y, -10000);
            }
          }
        }
        const wire = new BufferGeometry();
        wire.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        return { shapes, wire };
      }),
    [font, text]
  );
  useEffect(() => () => lines.forEach(({ wire }) => wire.dispose()), [lines]);
  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      const position = entity.get(Position)!;
      group.position.set(position.x, position.y, position.z);
      entity.add(Ref(group));
      return () => {
        if (entity.isAlive()) entity.remove(Ref);
      };
    },
    [entity]
  );

  useFrame(
    (state, delta) => {
      const root = entity.get(Ref);
      if (!root || !lettering.current || !mark.current) return;
      if (visible && !approach.current.visible) approach.current.time = 0;
      approach.current.visible = visible;
      root.visible = opacity.value > 0;
      lettering.current.visible = letterOpacity.value > 0;
      if (scrimMesh.current) scrimMesh.current.visible = scrim.value > 0 || robotVisible;
      if (!root.visible) return;
      approach.current.time += delta * Math.min(1, motion.current.boost);
      const distance = state.viewport.getCurrentViewport(state.camera, [0, 0, -260]);
      // Approach a fixed limit so the monumental title always stays in the distance.
      const arrival = lerp(0.94, 1, 1 - Math.exp(-approach.current.time / 240));
      const size = Math.min((distance.width * 0.96) / 6.5, (distance.height * 0.75) / 2.8) * arrival;
      lettering.current.scale.setScalar(size);
      lettering.current.position.set(
        -distance.width * 0.455 * arrival,
        -size * 0.1,
        horizon.z + easing.cubicIn(motion.current.warp) * 400
      );
      const { width, height } = state.viewport.getCurrentViewport(state.camera, root.position);
      const badge = height * 0.105;
      mark.current.scale.setScalar(badge);
      mark.current.quaternion.copy(state.camera.quaternion);
      mark.current.position
        .set(
          -width * 0.455 + badge / 2,
          -height / 2 + badge / 2,
          root.position.z - state.camera.position.z
        )
        .applyQuaternion(state.camera.quaternion)
        .add(state.camera.position)
        .sub(root.position);
    },
    { priority: -0.6 }
  );

  return (
    <group ref={handleInit} name="talk-title" visible={false}>
      <group ref={scenery} name="flight-scenery" matrixAutoUpdate={false}>
        <group ref={lettering} name="distant-title" rotation={[0, -0.008, 0]}>
          {lines.map(({ shapes, wire }, index) => (
            <group key={index} name={`title-line-${index}`} position={[0, 1 - index * 1.03, 0]}>
              <mesh position={[0, 0, 0.002]} renderOrder={-10}>
                <shapeGeometry args={[shapes, 12]} />
                <meshBasicNodeMaterial
                  color="#000000"
                  opacityNode={wireMaterial.faceOpacity}
                  maskNode={portal.mask}
                  transparent
                  toneMapped={false}
                />
              </mesh>
              <lineSegments geometry={wire} frustumCulled={false} renderOrder={-10}>
                <lineBasicNodeMaterial
                  color="#000000"
                  vertexNode={wireMaterial.vertex}
                  opacityNode={wireMaterial.opacity}
                  maskNode={portal.mask}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </lineSegments>
            </group>
          ))}
        </group>
        <TitleTravel opacity={flightOpacity} depth={horizon.z - 40} flight={motion} portal={portal} />
        <TitleObjects
          opacity={objectOpacity}
          depth={horizon.z - 100}
          flight={motion}
          restart={warpVisible}
          portal={portal}
        />
        <RobotReveal />
      </group>
      <mesh
        ref={scrimMesh}
        name="foreground-scrim"
        renderOrder={-5}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[2, 2]} />
        {/* Clear the background depth so flying objects stay behind the foreground. */}
        <meshBasicNodeMaterial
          colorNode={color(brand.green).mul(
            smoothstep(0.35, 1.35, uv().sub(0.5).mul(2).length()).mul(-0.85).add(1)
          )}
          vertexNode={vec4(positionLocal.xy, 0, 1)}
          depthNode={float(1)}
          opacityNode={scrim.mul(opacity).mul(0.54)}
          transparent
          depthTest={false}
          depthWrite
          toneMapped={false}
        />
      </mesh>
      <group
        ref={mark}
        name="brand-mark"
        renderOrder={100}
        userData={{ [EXCLUDE_FROM_BACKDROP]: true }}
      >
        <mesh renderOrder={100}>
          <planeGeometry args={[1, 1]} />
          <meshBasicNodeMaterial
            color="#000000"
            opacityNode={opacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0.05, 0, 0.01]} renderOrder={101}>
          <planeGeometry args={[0.27, 0.41]} />
          <meshBasicNodeMaterial
            color="#ffffff"
            opacityNode={opacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.075, -0.065, 0.02]} renderOrder={102}>
          <planeGeometry args={[0.31, 0.3]} />
          <meshBasicNodeMaterial
            color="#000000"
            opacityNode={opacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {[
          [-0.15, 0],
          [0, 0],
          [0, -0.15],
        ].map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0.03]} renderOrder={103}>
            <planeGeometry args={[0.125, 0.125]} />
            <meshBasicNodeMaterial
              color="#ffffff"
              opacityNode={opacity}
              transparent
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
