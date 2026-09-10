import type { GlyphLayoutInspection, TextCommitState } from '@pmndrs/glyph/three';
import { useFrame, useThree, type ThreeCamera } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useMemo, useRef, type RefObject } from 'react';
import {
  abs,
  attribute,
  cos,
  float,
  fwidth,
  mix,
  positionLocal,
  sin,
  smoothstep,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import type { BufferGeometry, Mesh, UniformNode, Vector3 } from 'three/webgpu';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ActiveScreen, ScreenTransition, Timeline } from '../../sim/index.js';
import {
  createLogoGeometry,
  createShardGeometry,
  createWordGeometry,
  logoBoxes,
} from '../principle-shards.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';

export type PrincipleWord = {
  id: string;
  word: string;
  y: number;
  /** The rendered text, which reports its glyph layout once committed */
  text: { commitState(): TextCommitState; glyphs(): GlyphLayoutInspection } | null;
};

/**
 * The principles break into little pieces that tumble away and settle as the Poimandres mark.
 * The pieces are cut from the same outlines the text is set in, so the words shatter exactly
 * as they appear on screen, and the whole flight is one uniform on the GPU. As pieces land they
 * swell and are trimmed to the mark's silhouette, so they melt together into the exact shape.
 * A held mark stays on screen beneath the charter until the sheet has covered it.
 */
export function PrincipleShardsRenderer({
  active,
  hold,
  covered,
  camera,
  center,
  font,
  words,
}: {
  active: boolean;
  /** Keep the finished mark on screen after the curtain lifts */
  hold: boolean;
  /** How far the charter has covered the held mark, from 0 to 1 */
  covered: UniformNode<'float', number>;
  camera: ThreeCamera;
  /** Logo center in the lettering's local space, kept in step with the viewport */
  center: UniformNode<'vec3', Vector3>;
  font: Font;
  words: RefObject<PrincipleWord[]>;
}) {
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const timeline = useQueryFirst(Timeline);
  const transition = useTrait(useTarget(timeline, ActiveScreen), ScreenTransition);
  const settled = active || hold;
  const progress = useTransitionOpacity(settled, {
    duration: active ? (transition?.duration ?? 2.8) : 0.5,
    ease: (value) => value,
    clock: 'frames',
  });
  const presence = useTransitionOpacity(settled, {
    duration: settled ? 0.18 : 0.5,
    clock: 'frames',
  });
  const mesh = useRef<Mesh>(null);
  const solid = useRef<Mesh>(null);
  const shards = useRef<BufferGeometry | null>(null);
  const logo = useMemo(() => createLogoGeometry(5.2), []);
  const material = useMemo(() => {
    const anchor = attribute<'vec3'>('center', 'vec3');
    const landing = attribute<'vec3'>('landing', 'vec3');
    const cloud = attribute<'vec3'>('cloud', 'vec3');
    const timing = attribute<'vec4'>('timing', 'vec4');
    // The outlines take over before a gentle left to right release.
    const released = timing.x.mul(0.12).add(0.12);
    const flight = progress.sub(released).div(timing.y.mul(0.05).add(0.7)).clamp();
    // Quintic easing leaves and arrives with zero velocity and acceleration.
    const travel = flight.pow(3).mul(flight.mul(flight.mul(6).sub(15)).add(10));
    const arc = travel.mul(travel.oneMinus()).mul(4);
    const pivot = mix(anchor, center.add(landing), travel).add(
      vec3(cloud.x.mul(0.16), cloud.y.mul(0.22), 0).mul(arc)
    );
    // Rotation follows the same easing, so it slows continuously into the mark.
    const spin = timing.z.sub(0.5).mul(2.4).mul(travel);
    // Settled pieces swell into their neighbours so the mark closes up without gaps
    const swell = mix(1, cloud.z, smoothstep(0.5, 1, flight));
    const local = positionLocal.sub(anchor).mul(swell);
    const turned = vec3(
      local.x.mul(cos(spin)).sub(local.y.mul(sin(spin))),
      local.x.mul(sin(spin)).add(local.y.mul(cos(spin))),
      local.z
    );
    const placed = varying(pivot.add(turned));
    // Signed distance to the mark's silhouette in the lettering's space, negative inside
    const point = placed.xy.sub(center.xy).div(5.2).add(0.5);
    const distance = logoBoxes
      .map(([left, bottom, right, top]) => {
        const offset = abs(point.sub(vec2((left + right) / 2, (bottom + top) / 2))).sub(
          vec2((right - left) / 2, (top - bottom) / 2)
        );
        return offset.max(0).length().add(offset.x.max(offset.y).min(0));
      })
      .reduce((nearest, box) => nearest.min(box), float(10));
    const feather = fwidth(distance).max(0.0001);
    const inside = smoothstep(feather, feather.negate(), distance);
    // Landing pieces are trimmed to the silhouette, so the assembled mark fits its lines
    const trim = smoothstep(0.65, 1, flight);
    const fade = presence.mul(covered.oneMinus());
    return {
      position: pivot.add(turned),
      opacity: fade.mul(mix(1, inside, trim)),
      mark: positionLocal.add(center),
      markOpacity: smoothstep(0.86, 1, progress).mul(fade),
    };
  }, [center, covered, presence, progress]);

  useFrame(
    () => {
      if (!mesh.current) return;
      if (!shards.current) {
        const geometries: BufferGeometry[] = [];
        for (const { word, y, text } of words.current) {
          if (!text || text.commitState().status !== 'committed') return;
          const outline = createWordGeometry(font, word, text.glyphs(), 0, y);
          if (outline) geometries.push(outline);
        }
        if (geometries.length === 0) return;
        shards.current = createShardGeometry(mergeGeometries(geometries), 5.2);
        mesh.current.geometry = shards.current;
        void warmUp(renderer, mesh.current, camera, scene);
      }
      mesh.current.visible = presence.value > 0;
      if (solid.current) solid.current.visible = mesh.current.visible;
    },
    { priority: -0.6 }
  );

  return (
    <>
      <mesh
        ref={solid}
        name="principle-mark"
        geometry={logo}
        frustumCulled={false}
        renderOrder={-0.6}
        visible={false}
      >
        <meshBasicNodeMaterial
          color="#000000"
          positionNode={material.mark}
          opacityNode={material.markOpacity}
          depthTest={false}
          depthWrite={false}
          transparent
        />
      </mesh>
      <mesh
        ref={mesh}
        name="principle-shards"
        frustumCulled={false}
        renderOrder={-0.5}
        visible={false}
      >
        <meshBasicNodeMaterial
          color="#000000"
          positionNode={material.position}
          opacityNode={material.opacity}
          depthTest={false}
          depthWrite={false}
          transparent
        />
      </mesh>
    </>
  );
}
