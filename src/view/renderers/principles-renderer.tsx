import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useLoader, useThree, type ThreeCamera } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { easing } from 'math/time';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { color, fwidth, positionLocal, smoothstep, uniform, uv, vec3, vec4 } from 'three/tsl';
import { Vector3, type Group, type Node } from 'three/webgpu';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { principles } from '../../data/principles.js';
import { ActiveScreen, PreviousScreen, Screen, ScreenTransition, Timeline } from '../../sim/index.js';
import { brand, fonts } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';
import { PrincipleShardsRenderer, type PrincipleWord } from './principle-shards-renderer.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);
useLoader.preload(FontLoader, fonts.geometry);

/** An opaque curtain covers the team before the typography enters. */
export function PrinciplesRenderer({
  camera,
  panel,
}: {
  camera: ThreeCamera;
  panel: ReturnType<typeof useTransitionOpacity>;
}) {
  const font = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const typeface = useLoader(FontLoader, fonts.geometry);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const transition = useTrait(screen, ScreenTransition);
  const visible = data?.principlesVisible ?? false;
  const tasteful = data?.id === 'principles-tasteful';
  const logo = data?.principlesLogo ?? false;
  // The finished mark stays under the charter and fades once the sheet has landed over it
  const hold = data?.charterVisible ?? false;
  const covered = useTransitionOpacity(
    !!data?.charterVisible ||
      (!visible && !!screen?.targetFor(PreviousScreen)?.get(Screen)?.charterVisible),
    { duration: 0.5, delay: data?.charterVisible ? (transition?.duration ?? 3.6) * 0.6 : 0 }
  );
  const dissolve = useTransitionOpacity(
    !!data?.charterFocus ||
      (!data?.charterVisible && !!screen?.targetFor(PreviousScreen)?.get(Screen)?.charterFocus),
    { duration: 2.2, ease: easing.cubicInOut }
  );
  const lift = useTransitionOpacity(tasteful || logo, { duration: 1.05, ease: easing.cubicInOut });
  const center = useMemo(() => uniform(new Vector3()), []);
  // The list sits lifted while the words come apart, so their outlines carry that offset
  const words = useRef<PrincipleWord[]>([
    ...principles.map(({ id, title }, index) => ({
      id,
      word: title,
      y: 2.6 - index * 1.36 + 0.45,
      text: null,
    })),
    { id: 'tasteful', word: 'Tasteful*', y: 2.6 - principles.length * 1.36 + 0.45, text: null },
  ]);
  const root = useRef<Group>(null);
  const lettering = useRef<Group>(null);
  const list = useRef<Group>(null);
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const target = useMemo(() => new Vector3(), []);
  const curtain = useMemo(() => {
    const top = uv().y.oneMinus();
    // The center pulls ahead with momentum, then the hem straightens as it lands.
    const bow = uv().x.mul(2).sub(1).pow(2).oneMinus();
    const edge = panel.mul(1.004).sub(0.002).add(panel.mul(Math.PI).sin().mul(bow).mul(0.26));
    const feather = fwidth(top).max(0.0001);
    return {
      vertex: vec4(positionLocal.xy.mul(2), 0, 1),
      opacity: smoothstep(edge.sub(feather), edge.add(feather), top)
        .oneMinus()
        .mul(dissolve.oneMinus()),
    };
  }, [panel, dissolve]);

  useEffect(() => {
    if (root.current) void warmUp(renderer, root.current, camera, scene);
  }, [renderer, camera, scene, curtain, font, mono]);

  useFrame(
    (state) => {
      if (!root.current || !lettering.current || !list.current) return;
      root.current.visible = panel.value > 0 || (hold && covered.value < 1);
      if (!root.current.visible) return;
      const { x, y, z } = camera.position;
      target.set(x, y, z - 6);
      const { width, height } = state.viewport.getCurrentViewport(camera, target);
      const scale = Math.min(height / 10, width / 11.5);
      lettering.current.position.set(x - width * 0.465, y, z - 6);
      lettering.current.scale.setScalar(scale);
      list.current.position.y = lift.value * 0.45;
      center.value.set((width * 0.465) / scale, 0, 0);
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="principles" visible={false}>
      <mesh name="principles-curtain" frustumCulled={false} renderOrder={-1}>
        <planeGeometry />
        <meshBasicNodeMaterial
          color={brand.red}
          vertexNode={curtain.vertex}
          opacityNode={curtain.opacity}
          depthTest={false}
          depthWrite={false}
          transparent
        />
      </mesh>
      <group ref={lettering}>
        <PrincipleLine
          visible={visible && !logo}
          delay={transition?.revealDelay ?? 0}
          position={[0, 4.35, 0]}
        >
          <Text font={mono} layout={{ wrap: 'none' }} style={{ fontSize: 0.22 }}>
            Our principles
          </Text>
        </PrincipleLine>
        <group ref={list} name="principle-list">
          {principles.map(({ id, title }, index) => (
            <PrincipleLine
              key={id}
              visible={visible && !logo}
              still={logo}
              delay={(transition?.revealDelay ?? 0) + index * 0.14}
              position={[0, 2.6 - index * 1.36, 0]}
            >
              <Text
                ref={(text) => void (words.current[index]!.text = text)}
                font={font}
                layout={{ wrap: 'none' }}
                style={{ fontSize: 1.42, lineHeight: 1 }}
              >
                {title}
              </Text>
            </PrincipleLine>
          ))}
          <PrincipleLine
            visible={tasteful}
            still={logo}
            delay={transition?.revealDelay ?? 0}
            position={[0, 2.6 - principles.length * 1.36, 0]}
          >
            <Text
              ref={(text) => void (words.current[principles.length]!.text = text)}
              font={font}
              layout={{ wrap: 'none' }}
              style={{ fontSize: 1.42, lineHeight: 1 }}
            >
              Tasteful*
            </Text>
          </PrincipleLine>
        </group>
        <PrincipleShardsRenderer
          active={logo}
          hold={hold}
          covered={covered}
          camera={camera}
          center={center}
          font={typeface}
          words={words}
        />
      </group>
    </group>
  );
}

function PrincipleLine({
  visible,
  still = false,
  delay,
  position,
  children,
}: {
  visible: boolean;
  /** Fade in place so particles can take over from the exact letter positions */
  still?: boolean;
  delay: number;
  position: [number, number, number];
  children: React.ReactNode;
}) {
  // Hold the words until their stationary pieces are opaque, then hand over before flight.
  const arrival = useTransitionOpacity(visible, {
    duration: visible ? 0.85 : still ? 0.12 : 0.2,
    delay: visible ? delay : still ? 0.18 : 0,
    clock: still ? 'frames' : 'timeline',
  });
  const drop = useMemo(() => uniform(1), []);
  useLayoutEffect(() => {
    // TSL uniforms carry mutable render state outside React
    // oxlint-disable-next-line react/immutability
    drop.value = still ? 0 : 1;
  }, [still, drop]);
  const material = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color('#000000');
        material.positionNode = context.position.add(
          vec3(0, arrival.oneMinus().mul(-0.45).mul(drop), 0)
        );
        const opacity = smoothstep(0, 0.65, arrival);
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(opacity) ?? opacity;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [arrival, drop]
  );
  return (
    <group position={position}>
      <TextGroup material={material} renderOrder={11}>
        {children}
      </TextGroup>
    </group>
  );
}
