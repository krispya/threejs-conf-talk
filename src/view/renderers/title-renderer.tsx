import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useQuery, useTrait } from 'koota/react';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  attribute,
  cameraNear,
  cameraProjectionMatrix,
  color,
  float,
  Fn,
  If,
  mix,
  modelViewMatrix,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  screenDPR,
  smoothstep,
  time,
  uv,
  varying,
  vec2,
  vec4,
  viewport,
} from 'three/tsl';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  ShapeGeometry,
  Vector3,
  type Group,
  type Mesh,
} from 'three/webgpu';
import { Position, Ref, Title } from '../../sim/index.js';
import { brand, fonts } from '../../theme.js';
import { useEntityVisible } from '../use-entity-visible.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { useTitleFlight } from '../use-title-flight.js';
import { useTitleGlitch } from '../use-title-glitch.js';
import { usePortal } from '../use-portal.js';
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
  const visible = useEntityVisible(entity);
  const opacity = useTransitionOpacity(visible);
  const { motion, scrim, speed, scenery, robotVisible, warpVisible } = useTitleFlight();
  const portal = usePortal();
  const glitch = useTitleGlitch();
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
  const approach = useRef({ visible: false, time: 0 });
  const horizon = useMemo(() => new Vector3(0, 0, -300), []);
  const wireMaterial = useMemo(() => {
    // Exponential depth growth starts at the letter faces and accelerates toward infinity
    const extension = speed.clamp().mul(Math.log(10001)).exp().sub(1).div(10000);
    const start = attribute<'vec3'>('instanceStart', 'vec3');
    const end = attribute<'vec3'>('instanceEnd', 'vec3');
    const depth = varying(mix(start.z, end.z, positionGeometry.y.clamp()).mul(extension));
    const vertex = Fn(() => {
      const a = modelViewMatrix.mul(vec4(start.xy, start.z.mul(extension), 1)).toVar();
      const b = modelViewMatrix.mul(vec4(end.xy, end.z.mul(extension), 1)).toVar();
      const near = cameraNear.negate();
      const hidden = a.z.greaterThan(near).and(b.z.greaterThan(near)).toVar();
      // Trim crossings before dividing by depth as the title passes the camera.
      If(a.z.greaterThan(near).and(b.z.lessThanEqual(near)), () => {
        a.assign(mix(a, b, near.sub(a.z).div(b.z.sub(a.z))));
      });
      If(b.z.greaterThan(near).and(a.z.lessThanEqual(near)), () => {
        b.assign(mix(b, a, near.sub(b.z).div(a.z.sub(b.z))));
      });
      const clipStart = cameraProjectionMatrix.mul(a);
      const clipEnd = cameraProjectionMatrix.mul(b);
      const direction = clipEnd.xy
        .div(clipEnd.w.max(cameraNear))
        .sub(clipStart.xy.div(clipStart.w.max(cameraNear)))
        .mul(viewport.zw);
      // Collapsed rails have no screen direction until the extrusion begins.
      const normal = vec2(direction.y, direction.x.negate()).div(direction.length().max(0.000001));
      const projected = mix(clipStart, clipEnd, positionGeometry.y.clamp());
      const offset = normal.mul(positionGeometry.x).mul(1.5).mul(screenDPR).div(viewport.zw);
      // Preserve perspective at arbitrary depths without clipping at the far plane.
      return hidden.select(
        vec4(0, 0, 0, -1),
        vec4(projected.xy.add(offset.mul(projected.w)), projected.w.mul(0.99999), projected.w)
      );
    })();
    return {
      vertex,
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
  const fragmentMaterial = useMemo(() => {
    const acceleration = smoothstep(0, 1, speed);
    const warp = smoothstep(1, 4, speed);
    const particle = attribute<'vec4'>('particle', 'vec4');
    // Each fragment has its own lifetime and tumbles away from a point on the contour.
    const age = time.mul(particle.y.mul(0.3).add(0.4)).add(particle.x).fract();
    const travel = age
      .pow(1.4)
      .mul(acceleration.mul(0.16).add(warp.mul(0.65)))
      .mul(particle.y.mul(0.7).add(0.65));
    const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
    const curl = age
      .pow(2)
      .mul(acceleration.mul(0.1).add(warp.mul(0.48)))
      .mul(particle.w.mul(0.8).add(0.4));
    const radial = clip.xy.mul(viewport.zw).mul(travel.add(1));
    const twisted = vec2(
      radial.x.mul(curl.cos()).sub(radial.y.mul(curl.sin())),
      radial.x.mul(curl.sin()).add(radial.y.mul(curl.cos()))
    ).div(viewport.zw);
    const spin = particle.w.mul(6.28).add(age.mul(particle.y.mul(8).sub(4)));
    const corner = uv()
      .mul(2)
      .sub(1)
      .mul(vec2(particle.y.mul(1.1).add(0.7), 1));
    const size = particle.z
      .pow(2)
      .mul(3.5)
      .add(1.25)
      .mul(smoothstep(0.55, 1, age).oneMinus())
      .mul(acceleration);
    const tumble = vec2(
      corner.x.mul(spin.cos()).sub(corner.y.mul(spin.sin())),
      corner.x.mul(spin.sin()).add(corner.y.mul(spin.cos()))
    );
    const outward = twisted.mul(viewport.zw);
    const direction = outward.div(outward.length().max(0.000001));
    const dash = direction
      .mul(corner.x)
      .mul(warp.mul(1.8).add(1.6))
      .add(vec2(direction.y.negate(), direction.x).mul(corner.y).mul(0.32));
    const offset = mix(tumble, dash, particle.w.greaterThan(0.75).select(1, 0))
      .mul(size)
      .mul(screenDPR)
      .mul(2)
      .div(viewport.zw)
      .mul(clip.w);
    const shape = uv().mul(2).sub(1);
    const chipped = shape
      .dot(shape)
      .add(mx_noise_float(shape.mul(4).add(varying(particle.w).mul(17))).mul(0.28));
    return {
      vertex: clip.w
        .greaterThan(cameraNear)
        .select(vec4(twisted.add(offset), clip.zw), vec4(0, 0, 0, -1)),
      opacity: smoothstep(0.68, 0.82, chipped)
        .oneMinus()
        .mul(smoothstep(0, 0.035, varying(age)))
        .mul(0.85)
        .mul(acceleration)
        .mul(letterOpacity)
        .mul(portal.outside),
    };
  }, [speed, letterOpacity, portal.outside]);
  // Nodes built during render are new objects every time, and a new node rebuilds its shader
  const faces = useMemo(
    () => ({
      steadyMask: portal.mask.and(glitch.mask.not()),
      glitchMask: portal.mask.and(glitch.mask),
      echoOpacity: wireMaterial.faceOpacity.mul(0.5),
      signalOpacity: wireMaterial.faceOpacity.mul(glitch.signal),
    }),
    [portal.mask, glitch, wireMaterial]
  );
  const scrimMaterial = useMemo(
    () => ({
      color: color(brand.green).mul(
        smoothstep(0.35, 1.35, uv().sub(0.5).mul(2).length()).mul(-0.85).add(1)
      ),
      vertex: vec4(positionLocal.xy, 0, 1),
      depth: float(1),
      opacity: scrim.mul(opacity).mul(0.54),
    }),
    [scrim, opacity]
  );
  const lines = useMemo(
    () =>
      text.split('\n').map((line) => {
        const shapes = font.generateShapes(line, 1);
        const vertices: number[] = [];
        const fragmentPositions: number[] = [];
        const fragmentUvs: number[] = [];
        const fragmentData: number[] = [];
        const fragmentIndices: number[] = [];
        // Smooth contour rings and spaced depth rails keep the extrusion legible.
        for (const shape of shapes) {
          for (const path of [shape, ...shape.holes]) {
            const contour = path.getPoints(12);
            for (const point of path.getSpacedPoints(
              Math.max(4, Math.ceil(path.getLength() / 0.12))
            )) {
              const offset = fragmentPositions.length / 3;
              const seed = offset / 4 + 1;
              for (let corner = 0; corner < 4; corner++) {
                fragmentPositions.push(point.x, point.y, 0);
                fragmentData.push(
                  (seed * 0.618034) % 1,
                  (seed * 0.754878) % 1,
                  (seed * 0.56984) % 1,
                  (seed * 0.43829) % 1
                );
              }
              fragmentUvs.push(0, 0, 1, 0, 0, 1, 1, 1);
              fragmentIndices.push(
                offset,
                offset + 1,
                offset + 2,
                offset + 2,
                offset + 1,
                offset + 3
              );
            }
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
        const wire = new LineSegmentsGeometry().setPositions(vertices);
        const fragments = new BufferGeometry();
        fragments.setAttribute('position', new Float32BufferAttribute(fragmentPositions, 3));
        fragments.setAttribute('uv', new Float32BufferAttribute(fragmentUvs, 2));
        fragments.setAttribute('particle', new Float32BufferAttribute(fragmentData, 4));
        fragments.setIndex(fragmentIndices);
        return { face: new ShapeGeometry(shapes, 12), wire, fragments };
      }),
    [font, text]
  );
  useEffect(
    () => () =>
      lines.forEach(({ face, wire, fragments }) => {
        face.dispose();
        wire.dispose();
        fragments.dispose();
      }),
    [lines]
  );
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
      if (!root || !lettering.current) return;
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
    },
    { priority: -0.6 }
  );

  return (
    <group ref={handleInit} name="talk-title" visible={false}>
      <group ref={scenery} name="flight-scenery" matrixAutoUpdate={false}>
        <group ref={lettering} name="distant-title" rotation={[0, -0.008, 0]}>
          {lines.map(({ face, wire, fragments }, index) => (
            <group key={index} name={`title-line-${index}`} position={[0, 1 - index * 1.03, 0]}>
              <mesh
                name="title-motion-fragments"
                geometry={fragments}
                frustumCulled={false}
                renderOrder={-11}
              >
                <meshBasicNodeMaterial
                  color="#000000"
                  vertexNode={fragmentMaterial.vertex}
                  opacityNode={fragmentMaterial.opacity}
                  maskNode={portal.mask}
                  side={DoubleSide}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh geometry={face} position={[0, 0, 0.002]} renderOrder={-10}>
                <meshBasicNodeMaterial
                  color="#000000"
                  opacityNode={wireMaterial.faceOpacity}
                  maskNode={faces.steadyMask}
                  transparent
                  toneMapped={false}
                />
              </mesh>
              <mesh geometry={face} position={[0, 0, 0.002]} renderOrder={-10}>
                <meshBasicNodeMaterial
                  color={brand.red}
                  vertexNode={glitch.echoVertex}
                  opacityNode={faces.echoOpacity}
                  maskNode={faces.glitchMask}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh geometry={face} position={[0, 0, 0.002]} renderOrder={-10}>
                <meshBasicNodeMaterial
                  color={brand.blue}
                  vertexNode={glitch.cyanVertex}
                  opacityNode={faces.echoOpacity}
                  maskNode={faces.glitchMask}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh geometry={face} position={[0, 0, 0.002]} renderOrder={-10}>
                <meshBasicNodeMaterial
                  color="#000000"
                  vertexNode={glitch.vertex}
                  opacityNode={faces.signalOpacity}
                  maskNode={faces.glitchMask}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <mesh geometry={wire} frustumCulled={false} renderOrder={-10}>
                <meshBasicNodeMaterial
                  color="#000000"
                  vertexNode={wireMaterial.vertex}
                  opacityNode={wireMaterial.opacity}
                  maskNode={portal.mask}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
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
          colorNode={scrimMaterial.color}
          vertexNode={scrimMaterial.vertex}
          depthNode={scrimMaterial.depth}
          opacityNode={scrimMaterial.opacity}
          transparent
          depthTest={false}
          depthWrite
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
