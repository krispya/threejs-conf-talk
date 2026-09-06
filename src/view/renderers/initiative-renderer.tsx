import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { defineTextMaterial } from '@pmndrs/glyph/three';
import { useFrame, useThree } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useTrait } from 'koota/react';
import { lerp } from 'math';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { color, float, mix, smoothstep, time, uniform, uv } from 'three/tsl';
import {
  AdditiveBlending,
  SRGBColorSpace,
  VideoTexture,
  type Group,
  type MeshBasicNodeMaterial,
  type Node,
} from 'three/webgpu';
import { Discovered, Hidden, Initiative, Position, Ref } from '../../sim/index.js';
import { fonts } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

useMSDF.preload(fonts.sans);

export function InitiativeRenderer() {
  const initiatives = useQuery(Initiative, Position);
  return initiatives.map((entity) => <InitiativeView key={entity} entity={entity} />);
}

function InitiativeView({ entity }: { entity: Entity }) {
  const data = useTrait(entity, Initiative)!;
  const visible = !useHas(entity, Hidden);
  const discovered = useHas(entity, Discovered);
  const [hovered, setHovered] = useState(false);
  const [reveal] = useState(() => uniform(data.secret ? 0 : 1));
  const opacity = useTransitionOpacity(visible, { delayed: true });
  const font = useMSDF(fonts.sans);
  const canvas = useThree((state) => state.gl.domElement);
  const body = useRef<Group>(null);
  const material = useRef<MeshBasicNodeMaterial>(null);
  const video = useRef<HTMLVideoElement>(null);
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

  const nodes = useMemo(() => {
    const radius = uv().sub(0.5).mul(2).length();
    const shown = reveal.mul(opacity);
    return {
      shown,
      disk: float(1)
        .sub(smoothstep(0.96, 1, radius))
        .mul(shown),
      glow: radius.mul(radius).mul(-6).exp().mul(opacity).mul(reveal.mul(0.18).add(0.025)),
      surface: mix(
        color(data.color).mul(0.16),
        color(data.color),
        uv()
          .y.mul(0.6)
          .add(time.mul(0.12).add(uv().x.mul(5)).sin().mul(0.12))
          .clamp()
      ),
      signal: opacity.mul(reveal.oneMinus()).mul(time.mul(0.3).sin().mul(0.15).add(0.65)),
    };
  }, [data.color, opacity, reveal]);
  const textMaterial = useMemo(
    () =>
      defineTextMaterial((context) => {
        const material = context.createDefaultMaterial();
        material.colorNode = color('#fffdfa');
        material.opacityNode =
          (material.opacityNode as Node<'float'> | null)?.mul(nodes.shown) ?? nodes.shown;
        material.depthWrite = false;
        return material;
      }),
    [nodes.shown]
  );

  // Keep each clip and GPU texture for the lifetime of its point of interest.
  useEffect(() => {
    if (!data.video) return;
    const element = document.createElement('video');
    element.muted = true;
    element.loop = true;
    element.playsInline = true;
    element.preload = 'auto';
    element.src = data.video;
    const texture = new VideoTexture(element);
    texture.colorSpace = SRGBColorSpace;
    const target = material.current;
    const attach = () => {
      if (!target) return;
      const aspect = element.videoWidth / element.videoHeight;
      texture.repeat.set(Math.min(1, 1 / aspect), Math.min(1, aspect));
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
      target.map = texture;
      target.colorNode = null;
      target.needsUpdate = true;
    };
    element.addEventListener('loadeddata', attach);
    element.load();
    video.current = element;
    return () => {
      element.removeEventListener('loadeddata', attach);
      element.pause();
      if (target) {
        target.map = null;
        target.colorNode = nodes.surface;
        target.needsUpdate = true;
      }
      texture.dispose();
      element.removeAttribute('src');
      element.load();
      video.current = null;
    };
  }, [data.video, nodes.surface]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (visible && (!data.secret || discovered)) void element.play().catch(() => {});
    else element.pause();
    return () => element.pause();
  }, [visible, data.video, data.secret, discovered]);

  useEffect(() => {
    if (!hovered || !visible) return;
    const previous = canvas.style.cursor;
    canvas.style.setProperty('cursor', 'pointer');
    return () => canvas.style.setProperty('cursor', previous);
  }, [canvas, hovered, visible]);

  useFrame(
    (_, delta) => {
      const group = entity.get(Ref);
      if (group) group.visible = opacity.value > 0;
      // TSL uniforms carry mutable render state outside React
      // oxlint-disable-next-line react/immutability
      reveal.value = lerp(reveal.value, !data.secret || discovered ? 1 : 0, 1 - Math.exp(-delta * 5));
      if (body.current) {
        const scale = lerp(
          body.current.scale.x,
          hovered && visible ? 1.12 : 1,
          1 - Math.exp(-delta * 7)
        );
        body.current.scale.setScalar(scale);
      }
    },
    { priority: -0.6 }
  );

  return (
    <group ref={handleInit} name={`initiative-${data.id}`} visible={false}>
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[28, 28]} />
        <meshBasicNodeMaterial
          color={data.color}
          opacityNode={nodes.glow}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicNodeMaterial
          color={data.color}
          opacityNode={nodes.signal}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={body}>
        <mesh>
          <planeGeometry args={[14, 14]} />
          <meshBasicNodeMaterial
            ref={material}
            colorNode={nodes.surface}
            opacityNode={nodes.disk}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation={[0, 0, 0.35]}>
          <ringGeometry args={[7.5, 7.56, 96, 1, 0, Math.PI * 1.78]} />
          <meshBasicNodeMaterial
            color={data.color}
            opacityNode={nodes.shown}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <TextGroup material={textMaterial} renderOrder={2}>
        <Text
          font={font}
          position={[-25, -9.2, 0.2]}
          constraints={{ width: { mode: 'exact', size: 50 } }}
          layout={{ align: 'center', wrap: 'none' }}
          style={{ fontSize: 2.8, lineHeight: 1 }}
        >
          {data.title}
        </Text>
      </TextGroup>
      <mesh
        name={`initiative-hit-${data.id}`}
        position={[0, 0, 0.3]}
        onPointerOver={(event) => {
          if (!visible || opacity.value < 0.95) return;
          event.stopPropagation();
          setHovered(true);
          if (data.secret) entity.add(Discovered);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          if (!visible || opacity.value < 0.95) return;
          event.stopPropagation();
          if (data.secret) entity.add(Discovered);
          else if (data.source) window.open(data.source, '_blank', 'noopener,noreferrer');
        }}
      >
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
