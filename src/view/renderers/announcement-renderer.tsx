import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { lerp } from 'math';
import { easing } from 'math/time';
import { useMemo, useRef } from 'react';
import { color, normalView, smoothstep } from 'three/tsl';
import { SRGBColorSpace, type Group } from 'three/webgpu';
import { ActiveScreen, PreviousScreen, Screen, Timeline } from '../../sim/index.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { DocumentCollapse } from './document-collapse.js';

useTexture.preload('./announcements/charter-post.svg');

/** The announcement rises into a champagne frame and holds until the black hole takes it. */
export function AnnouncementRenderer() {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const visible = useTrait(screen, Screen)?.announcementVisible ?? false;
  const collapsing =
    !visible && !!screen?.targetFor(PreviousScreen)?.get(Screen)?.announcementVisible;
  const progress = useTransitionOpacity(visible, {
    duration: visible ? 1.9 : collapsing ? undefined : 0.8,
    delay: visible ? 0.65 : 0,
    ease: easing.cubicInOut,
    restartOnChange: collapsing,
  });
  const image = useTexture('./announcements/charter-post.svg', (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  const source = image.image as HTMLImageElement;
  const height = (24 * source.height) / source.width;
  const opacity = useMemo(() => smoothstep(0, 0.12, progress), [progress]);
  const gold = useMemo(() => color('#d7bb81').mul(normalView.z.abs().mul(0.32).add(0.68)), []);
  const root = useRef<Group>(null);
  const sheet = useRef<Group>(null);

  useFrame(
    (state) => {
      if (!root.current || !sheet.current) return;
      root.current.visible = progress.value > 0;
      sheet.current.visible = !collapsing;
      if (!root.current.visible || collapsing) return;
      const viewport = state.viewport.getCurrentViewport(state.camera, root.current.position);
      root.current.scale.setScalar(
        Math.min((viewport.width * 0.78) / 27.2, (viewport.height * 0.84) / (height + 3.2))
      );
      sheet.current.position.y = lerp(-height - 12, 0, progress.value);
      sheet.current.rotation.set(
        lerp(0.12, 0, progress.value),
        lerp(-0.1, 0, progress.value),
        lerp(-0.09, -0.012, progress.value)
      );
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="framed-announcement" position={[0, 0, -11]} visible={false}>
      <DocumentCollapse sheet={sheet} progress={progress} width={27.6} height={height + 3.6} />
      <group ref={sheet} name="announcement-frame">
        <mesh position={[0.3, -0.35, -0.35]} renderOrder={3}>
          <boxGeometry args={[26.8, height + 2.8, 0.18]} />
          <meshBasicNodeMaterial
            color="#30253b"
            opacityNode={opacity.mul(0.2)}
            transparent
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={4}>
          <boxGeometry args={[26.8, height + 2.8, 0.5]} />
          <meshBasicNodeMaterial
            colorNode={gold}
            opacityNode={opacity}
            transparent
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.27]} renderOrder={5}>
          <boxGeometry args={[26.25, height + 2.25, 0.06]} />
          <meshBasicNodeMaterial
            color="#746346"
            opacityNode={opacity}
            transparent
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.32]} renderOrder={5}>
          <boxGeometry args={[25.95, height + 1.95, 0.06]} />
          <meshBasicNodeMaterial
            color="#faf7f0"
            opacityNode={opacity}
            transparent
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.37]} renderOrder={6}>
          <planeGeometry args={[24, height]} />
          <meshBasicNodeMaterial map={image} opacityNode={opacity} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
