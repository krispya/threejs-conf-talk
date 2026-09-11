import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useMemo, useRef } from 'react';
import { smoothstep } from 'three/tsl';
import { SRGBColorSpace, type Group, type Node } from 'three/webgpu';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);
useMSDF.preload(fonts.mono);
useTexture.preload('./closing/discord-qr.png');

/** The send off: black type on the brand cyan with the Discord invite as a QR code. */
export function ClosingRenderer() {
  const sans = useMSDF(fonts.sans);
  const mono = useMSDF(fonts.mono);
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.closingVisible ?? false;
  // The glade fades out first, then the words rise and the code follows a beat later
  const progress = useTransitionOpacity(visible, {
    duration: visible ? 1.1 : 0.35,
    delay: visible ? 0.3 : 0,
    ease: easing.cubicOut,
    clock: 'frames',
  });
  const code = useTransitionOpacity(visible, {
    duration: visible ? 1 : 0.35,
    delay: visible ? 0.75 : 0,
    ease: easing.cubicOut,
    clock: 'frames',
  });
  const qr = useTexture('./closing/discord-qr.png', (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  const ink = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(progress) ?? progress;
        material.depthTest = false;
        material.depthWrite = false;
        return material;
      }),
    [progress]
  );
  const codeOpacity = useMemo(() => smoothstep(0, 0.5, code), [code]);
  const root = useRef<Group>(null);
  const chip = useRef<Group>(null);
  const words = useRef<Group>(null);
  const invite = useRef<Group>(null);

  useFrame(
    (state) => {
      if (!root.current || !chip.current || !words.current || !invite.current) return;
      root.current.visible = progress.value > 0 || code.value > 0;
      if (!root.current.visible) return;
      // Frame a 16 by 9 layout a fixed distance in front of wherever the camera rests
      const { x, y, z } = state.camera.position;
      root.current.position.set(x, y, z - 6);
      const { width, height } = state.viewport.getCurrentViewport(
        state.camera,
        root.current.position
      );
      const scale = Math.min(height / 9, width / 16);
      root.current.scale.setScalar(scale);
      chip.current.position.set((-width * 0.455) / scale, (height * 0.46) / scale, 0);
      words.current.position.y = lerp(-0.4, 0, progress.value);
      invite.current.scale.setScalar(lerp(0.96, 1, code.value));
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="closing" visible={false}>
      <group ref={chip} name="closing-chip">
        <mesh position={[1.95, -0.23, 0]} renderOrder={40}>
          <planeGeometry args={[3.9, 0.46]} />
          <meshBasicNodeMaterial
            color="#000000"
            opacityNode={progress}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <TextGroup material={ink} renderOrder={41}>
          <Text
            font={mono}
            position={[0.15, -0.06, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 0.25, lineHeight: 1, color: '#ffffff' }}
          >
            This only works together
          </Text>
        </TextGroup>
      </group>
      <group ref={words} name="closing-words">
        <TextGroup material={ink} renderOrder={40}>
          <Text
            font={sans}
            position={[-7.28, 2.55, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 2.6, lineHeight: 1, color: '#000000' }}
          >
            Join
          </Text>
          <Text
            font={sans}
            position={[-7.28, 0.8, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 2.6, lineHeight: 1, color: '#000000' }}
          >
            us.
          </Text>
        </TextGroup>
      </group>
      <group ref={invite} name="discord-invite" position={[5.9, -2, 0]}>
        <TextGroup material={ink} renderOrder={41}>
          <Text
            font={mono}
            position={[-1.2, -1.7, 0]}
            layout={{ wrap: 'none' }}
            style={{ fontSize: 0.18, lineHeight: 1, color: '#000000' }}
          >
            discord.gg/poimandres
          </Text>
        </TextGroup>
        <mesh renderOrder={40}>
          <planeGeometry args={[2.4, 2.4]} />
          <meshBasicNodeMaterial
            map={qr}
            opacityNode={codeOpacity}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
