import { useResource, useViewBinding, useEntityVisible, type FrameStep } from '../view/hooks.js';
import { Position } from '../traits.js';
import { useQuery, useTrait } from 'koota/react';
import { Title } from './traits.js';
import { createTitleGeometry } from './utils/geometry.js';
import { createTitleFragmentNodes, createTitleWireNodes } from './utils/materials.js';
import { Ref } from '../view/traits.js';
import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useRef } from 'react';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { color, float, positionLocal, smoothstep, uv, vec4 } from 'three/tsl';
import { DoubleSide, Vector3, type Group, type Mesh } from 'three/webgpu';
import { brand, fonts } from '../theme.js';
import { useTransitionOpacity } from '../transition/use-transition-opacity.js';
import { useTitleFlight } from './use-flight.js';
import { useTitleGlitch } from './use-glitch.js';
import { usePortal } from './use-portal.js';
import { TitleTravel } from './travel.js';
import { TitleObjects } from './objects.js';
import { RobotReveal } from '../robot/renderer.js';

export function TitleRenderer() {
  const titles = useQuery(Title, Position);
  return titles.map((entity) => <TitleView key={entity} entity={entity} />);
}

useLoader.preload(FontLoader, fonts.geometry);

function TitleView({ entity }: { entity: Entity }) {
  const font = useLoader(FontLoader, fonts.geometry);
  const { text } = useTrait(entity, Title)!;
  const visible = useEntityVisible(entity);
  const opacity = useTransitionOpacity(visible);
  const flight = useTitleFlight();
  const { motion, scrim, speed, scenery, robotVisible, warpVisible } = flight;
  const portal = usePortal();
  const glitch = useTitleGlitch();
  // Child views register their steps here and run after the flight, portal, and glitch clocks
  const steps = new Set<FrameStep>();
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
  const horizon = new Vector3(0, 0, -300);
  const wireMaterial = createTitleWireNodes(speed, letterOpacity, portal.outside);
  const fragmentMaterial = createTitleFragmentNodes(speed, letterOpacity, portal.outside);
  const faces = {
    steadyMask: portal.mask.and(glitch.mask.not()),
    glitchMask: portal.mask.and(glitch.mask),
    echoOpacity: wireMaterial.faceOpacity.mul(0.5),
    signalOpacity: wireMaterial.faceOpacity.mul(glitch.signal),
  };
  const scrimMaterial = {
    color: color(brand.green).mul(
      smoothstep(0.35, 1.35, uv().sub(0.5).mul(2).length()).mul(-0.85).add(1)
    ),
    vertex: vec4(positionLocal.xy, 0, 1),
    depth: float(1),
    opacity: scrim.mul(opacity).mul(0.54),
  };
  const [lines] = useResource(
    () => createTitleGeometry(font, text),
    (lines) => {
      for (const { face, wire, fragments } of lines) {
        face.dispose();
        wire.dispose();
        fragments.dispose();
      }
    },
    [font, text]
  );
  const bindView = useViewBinding(entity);
  const handleInit = (group: Group | null) => {
    if (!group) return;
    const position = entity.get(Position)!;
    group.position.set(position.x, position.y, position.z);
    const release = bindView(group);
    return () => {
      release?.();
    };
  };

  // One callback orders the title's clocks, its lettering, and the child steps within a frame
  useFrame((state, delta) => {
    flight.step(state, delta);
    portal.step(state, delta);
    glitch.step(state, delta);
    const root = entity.get(Ref);
    if (root && lettering.current) {
      if (visible && !approach.current.visible) approach.current.time = 0;
      approach.current.visible = visible;
      root.visible = opacity.value > 0;
      lettering.current.visible = letterOpacity.value > 0;
      if (scrimMesh.current) scrimMesh.current.visible = scrim.value > 0 || robotVisible;
      if (root.visible) {
        approach.current.time += delta * Math.min(1, motion.current.boost);
        const distance = state.viewport.getCurrentViewport(state.camera, [0, 0, -260]);
        // Approach a fixed limit so the monumental title always stays in the distance.
        const arrival = lerp(0.94, 1, 1 - Math.exp(-approach.current.time / 240));
        const size =
          Math.min((distance.width * 0.96) / 6.5, (distance.height * 0.75) / 2.8) * arrival;
        lettering.current.scale.setScalar(size);
        lettering.current.position.set(
          -distance.width * 0.455 * arrival,
          -size * 0.1,
          horizon.z + easing.cubicIn(motion.current.warp) * 400
        );
      }
    }
    for (const step of steps) step(state, delta);
  });

  if (!lines) return null;

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
        <TitleTravel
          opacity={flightOpacity}
          depth={horizon.z - 40}
          flight={motion}
          portal={portal}
          steps={steps}
        />
        <TitleObjects
          opacity={objectOpacity}
          depth={horizon.z - 100}
          flight={motion}
          restart={warpVisible}
          portal={portal}
          steps={steps}
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
