import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useLoader, type ThreeCamera } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useMemo, useRef } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { color } from 'three/tsl';
import { EdgesGeometry, type Group, type Mesh, type Node } from 'three/webgpu';
import { ActiveScreen, Screen, Time, Timeline } from '../../sim/index.js';
import { brand, fonts, ramp } from '../../theme.js';
import { packageSpring } from '../package-spring.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { WaveBubble } from './wave-bubble.js';

useLoader.preload(GLTFLoader, './meshes/pmndrs.glb');
useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);

export function GreetingRenderer({
  camera,
  onReady,
}: {
  camera: ThreeCamera;
  onReady: (group: Group) => void;
}) {
  const gltf = useLoader(GLTFLoader, './meshes/pmndrs.glb');
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const timing = useTrait(timeline, Timeline);
  const visible = data?.greetingVisible ?? false;
  const work = data?.id === 'work';
  const arrivedAt = useRef(0);
  useEffect(() => {
    if (visible) arrivedAt.current = world.get(Time)!.elapsed;
  }, [visible, world]);
  const entrance = useTransitionOpacity(visible, {
    duration: 1.25,
    delay: visible ? 0.15 : 0,
    ease: visible ? easing.cubicOut : easing.cubicInOut,
  });
  const caption = useTransitionOpacity(visible && !work, {
    duration: work ? 0.35 : visible ? 0.7 : 1.1,
    delay: visible && !work ? 0.75 : 0,
    ease: visible ? easing.cubicOut : easing.cubicInOut,
  });
  const greeting = useTransitionOpacity(visible && !work, {
    duration: work ? 0.3 : visible ? 0.6 : 1,
    delay: visible && !work ? 1.35 : 0,
    ease: visible ? easing.cubicOut : easing.cubicInOut,
  });
  const question = useTransitionOpacity(work, {
    duration: work ? 0.65 : 0.3,
    delay: work ? 0.3 : 0,
  });
  const root = useRef<Group>(null);
  const character = useRef<Group>(null);
  const words = useRef<Group>(null);
  const bubble = useRef<Group>(null);
  const hand = useRef<Group>(null);
  const questionWords = useRef<Group>(null);
  const thinkingBubble = useRef<Group>(null);
  const gearBubble = useRef<Group>(null);
  const thinking = useRef<Group>(null);
  const gear = useRef<Group>(null);
  const model = useMemo(() => {
    const geometry = (gltf.scene.getObjectByName('logo') as Mesh).geometry.clone();
    geometry.center();
    geometry.scale(0.188, 0.188, 0.97);
    return { geometry, edges: new EdgesGeometry(geometry) };
  }, [gltf]);
  useEffect(
    () => () => {
      model.geometry.dispose();
      model.edges.dispose();
    },
    [model]
  );

  const questionMaterial = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color(brand.dark);
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(question) ?? question;
        material.depthWrite = false;
        return material;
      }),
    [question]
  );
  const textMaterial = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color(brand.dark);
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(caption) ?? caption;
        material.depthWrite = false;
        return material;
      }),
    [caption]
  );

  useEffect(() => {
    if (root.current) onReady(root.current);
  }, [onReady, model, textMaterial]);

  useFrame(
    (state) => {
      if (!root.current || !character.current || !words.current || !bubble.current || !hand.current)
        return;
      root.current.visible =
        entrance.value > 0 || caption.value > 0 || greeting.value > 0 || question.value > 0;
      if (!root.current.visible) return;

      const { width, height } = state.viewport.getCurrentViewport(camera, [0, 0, -11]);
      const scale = Math.min(width / 8.6, height / 4.8);
      root.current.scale.setScalar(scale);
      const now = world.get(Time)!.elapsed;
      const elapsed = now - (timing?.startedAt ?? now);
      const arrival = visible
        ? packageSpring(clamp((now - arrivedAt.current - 0.15) / 1.25, 0, 1))
        : entrance.value;
      character.current.position.set(
        lerp(-width / (2 * scale) - 2, -2.2, arrival),
        Math.sin(clamp(arrival, 0, 1) * Math.PI) * 0.65 + Math.sin(now * 0.8) * 0.055,
        0
      );
      character.current.rotation.set(
        -0.1 + Math.sin(now * 0.55) * 0.035,
        lerp(-0.8, -0.2, arrival) + Math.sin(now * 0.65) * 0.065,
        lerp(-0.6, -0.06, arrival) + Math.sin(now * 0.7) * 0.025
      );
      character.current.scale.setScalar(2.15 * lerp(0.7, 1, arrival));
      words.current.position.y = lerp(-0.18, 0, caption.value);
      words.current.visible = caption.value > 0;

      const pop =
        visible && !work ? packageSpring(clamp((elapsed - 1.35) / 0.6, 0, 1)) : greeting.value;
      bubble.current.visible = greeting.value > 0;
      bubble.current.scale.setScalar(Math.max(0.001, pop));
      bubble.current.position.y = 1.28 + Math.sin(now * 0.9) * 0.04;
      bubble.current.rotation.z = lerp(-0.24, 0.06, pop);
      const wave = clamp((elapsed - 1.5) / 1.8, 0, 1);
      hand.current.rotation.z = Math.sin(wave * Math.PI * 8) * Math.sin(wave * Math.PI) * 0.25;

      if (questionWords.current) {
        questionWords.current.visible = question.value > 0;
        questionWords.current.position.y = lerp(-0.16, 0, question.value);
      }
      if (thinkingBubble.current && gearBubble.current && thinking.current && gear.current) {
        thinkingBubble.current.visible = gearBubble.current.visible = question.value > 0;
        const thinkingPop = work
          ? packageSpring(clamp((elapsed - 0.4) / 0.65, 0, 1))
          : question.value;
        const gearPop = work ? packageSpring(clamp((elapsed - 0.6) / 0.65, 0, 1)) : question.value;
        thinkingBubble.current.scale.setScalar(Math.max(0.001, thinkingPop));
        gearBubble.current.scale.setScalar(Math.max(0.001, gearPop) * 0.7);
        thinkingBubble.current.position.y = 1.28 + Math.sin(now * 1.2) * 0.06;
        gearBubble.current.position.y = 1.5 + Math.sin(now * 1.2 + 1.4) * 0.08;
        thinking.current.rotation.z = Math.sin(now * 1.6) * 0.12;
        gear.current.rotation.z = -now * 0.65;
      }
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="hello-poimandres" position={[0, 0, -11]} visible={false}>
      <group ref={character} name="pmndrs-character">
        <mesh geometry={model.geometry} dispose={null}>
          <meshStandardNodeMaterial
            color={ramp['light-25']}
            metalness={0.12}
            roughness={0.3}
            opacityNode={entrance}
            transparent
          />
        </mesh>
        <lineSegments geometry={model.edges} dispose={null}>
          <lineBasicNodeMaterial color={brand.dark} opacityNode={entrance} transparent />
        </lineSegments>
      </group>
      <group ref={words} name="poimandres-introduction">
        <TextGroup material={textMaterial}>
          <Text font={mono} position={[-0.35, 0.55, 0]} style={{ fontSize: 0.28, lineHeight: 1 }}>
            hello, we are
          </Text>
          <Text font={sans} position={[-0.39, 0.1, 0]} style={{ fontSize: 0.67, lineHeight: 1 }}>
            poimandres
          </Text>
        </TextGroup>
      </group>
      <group ref={bubble} name="hello-speech-bubble" position={[-0.1, 1.28, 0.65]}>
        <WaveBubble opacity={greeting} handRef={hand} />
      </group>
      <group ref={questionWords} name="how-work-gets-done" visible={false}>
        <TextGroup material={questionMaterial}>
          <Text font={mono} position={[-0.35, 0.55, 0]} style={{ fontSize: 0.28, lineHeight: 1 }}>
            How does the
          </Text>
          <Text font={sans} position={[-0.39, 0.1, 0]} style={{ fontSize: 0.56, lineHeight: 1 }}>
            work get done?
          </Text>
        </TextGroup>
      </group>
      <group
        ref={thinkingBubble}
        name="thinking-speech-bubble"
        position={[-0.1, 1.28, 0.65]}
        visible={false}
      >
        <WaveBubble opacity={question} handRef={thinking} emoji="🤔" />
      </group>
      <group ref={gearBubble} name="gear-speech-bubble" position={[1.05, 1.5, 0.65]} visible={false}>
        <WaveBubble opacity={question} handRef={gear} emoji="⚙️" />
      </group>
    </group>
  );
}
