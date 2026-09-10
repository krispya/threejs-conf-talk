import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useMemo, useRef } from 'react';
import { color, smoothstep } from 'three/tsl';
import { SRGBColorSpace, type Group, type Node } from 'three/webgpu';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.sansLight);
useMSDF.preload(fonts.mono);
useTexture.preload('./closing/discord-qr.png');

/** The send off: black type on the brand cyan with the Discord invite as a QR code. */
export function ClosingRenderer() {
  const sans = useMSDF(fonts.sans);
  const light = useMSDF(fonts.sansLight);
  const mono = useMSDF(fonts.mono);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.closingVisible ?? false;
  // The glade fades out first, then the words rise and the code follows a beat later
  const progress = useTransitionOpacity(visible, {
    duration: visible ? 1.1 : 0.35,
    delay: visible ? 0.3 : 0,
    ease: easing.cubicOut,
  });
  const code = useTransitionOpacity(visible, {
    duration: visible ? 1 : 0.35,
    delay: visible ? 0.75 : 0,
    ease: easing.cubicOut,
  });
  const qr = useTexture('./closing/discord-qr.png', (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  const ink = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color('#000000');
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(progress) ?? progress;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [progress]
  );
  const caption = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color('#000000');
        material.opacityNode = (material.opacityNode as Node<'float'> | null)?.mul(code) ?? code;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [code]
  );
  const codeOpacity = useMemo(() => smoothstep(0, 0.5, code), [code]);
  const root = useRef<Group>(null);
  const words = useRef<Group>(null);
  const invite = useRef<Group>(null);

  useFrame(
    (state) => {
      if (!root.current || !words.current || !invite.current) return;
      root.current.visible = progress.value > 0 || code.value > 0;
      if (!root.current.visible) return;
      // Frame a 16 by 9 layout a fixed distance in front of wherever the camera rests
      const { x, y, z } = state.camera.position;
      root.current.position.set(x, y, z - 6);
      const { width, height } = state.viewport.getCurrentViewport(
        state.camera,
        root.current.position
      );
      root.current.scale.setScalar(Math.min(height / 9, width / 16));
      words.current.position.y = lerp(-0.6, 0, progress.value);
      invite.current.scale.setScalar(lerp(0.92, 1, code.value));
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="closing" visible={false}>
      <group ref={words} name="closing-words">
        <TextGroup material={ink} renderOrder={40}>
          <Text
            font={sans}
            position={[-7.2, 1.65, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 1.2, lineHeight: 1 }}
          >
            COME JOIN US
          </Text>
          <Text
            font={light}
            position={[-7.2, 0.15, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 0.56, lineHeight: 1 }}
          >
            This only works together
          </Text>
        </TextGroup>
      </group>
      <group ref={invite} name="discord-invite" position={[5, 0, 0]}>
        <mesh renderOrder={40}>
          <planeGeometry args={[3.9, 3.9]} />
          <meshBasicNodeMaterial
            map={qr}
            opacityNode={codeOpacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <TextGroup material={caption} renderOrder={41}>
          <Text
            font={mono}
            position={[-1.95, -2.25, 0]}
            constraints={{ width: { mode: 'exact', size: 3.9 } }}
            layout={{ align: 'center', wrap: 'none' }}
            style={{ fontSize: 0.27, lineHeight: 1 }}
          >
            discord.gg/poimandres
          </Text>
        </TextGroup>
      </group>
    </group>
  );
}
