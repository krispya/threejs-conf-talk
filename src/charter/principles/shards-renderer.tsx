import { useResource } from '../../view/hooks.js';
import type { GlyphLayoutInspection, TextCommitState } from '@pmndrs/glyph/three';
import { useFrame, useThree, type ThreeCamera } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { useRef, type RefObject } from 'react';
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
import { BufferGeometry, type Mesh, type UniformNode, type Vector3 } from 'three/webgpu';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ActiveScreen, ScreenTransition, Timeline } from '../../timeline/traits.js';
import {
  createShardGeometry,
  createWordGeometry,
  logoBoxes,
  type WordBounds,
} from './utils/geometry.js';
import { useTransitionOpacity } from '../../transition/use-transition-opacity.js';
import { warmUp } from '../../view/utils/warm-up.js';
import { soundActions } from '../../sound/actions.js';
import { pitch } from '../../sound/systems.js';

export type PrincipleWord = {
  id: string;
  word: string;
  y: number;
  /** The rendered text, which reports its glyph layout once committed */
  text: { commitState(): TextCommitState; glyphs(): GlyphLayoutInspection } | null;
};

/**
 * Letter fragments peel away in a staggered stream and stack into a loose collage of the mark.
 * Unreleased fragments retain the words while the earliest arrivals begin building the logo.
 * The collage stays beneath the charter until the sheet covers it.
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
  const world = useWorld();
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const timeline = useQueryFirst(Timeline);
  const transition = useTrait(useTarget(timeline, ActiveScreen), ScreenTransition);
  const settled = active || hold;
  const progress = useTransitionOpacity(settled, {
    duration: active ? (transition?.duration ?? 4.2) : 0.5,
    ease: (value) => value,
    clock: 'frames',
  });
  const presence = useTransitionOpacity(settled, {
    duration: settled ? 0.08 : 0.5,
    clock: 'frames',
  });
  const mesh = useRef<Mesh>(null);
  const heard = useRef({
    progress: 1,
    releases: [] as number[],
    arrivals: [] as { at: number; pan: number }[],
    finished: 1,
  });
  const [shards] = useResource(
    () => new BufferGeometry(),
    (geometry) => geometry.dispose(),
    [font]
  );

  const anchor = attribute<'vec3'>('center', 'vec3');
  const landing = attribute<'vec3'>('landing', 'vec3');
  const cloud = attribute<'vec3'>('cloud', 'vec3');
  const timing = attribute<'vec4'>('timing', 'vec4');
  const flight = progress.sub(timing.x).div(timing.y).clamp();
  // A long flight slows into a restrained overshoot so each landing remains easy to follow
  const remaining = flight.sub(1);
  const overshoot = timing.z.mul(0.35).add(0.45);
  const travel = remaining
    .pow(2)
    .mul(remaining.mul(overshoot.add(1)).add(overshoot))
    .add(1);
  const bend = smoothstep(0, 1, flight);
  const arc = bend.mul(bend.oneMinus()).mul(4);
  const pivot = mix(anchor, center.add(landing), travel).add(vec3(cloud.x, cloud.y, 0).mul(arc));
  const spin = timing.z.sub(0.5).mul(0.65).mul(travel);
  const local = positionLocal.sub(anchor).mul(mix(1, cloud.z, travel));
  const turned = vec3(
    local.x.mul(cos(spin)).sub(local.y.mul(sin(spin))),
    local.x.mul(sin(spin)).add(local.y.mul(cos(spin))),
    local.z
  );
  // Leave a ragged margin around the blocks while keeping the logo's negative space open
  const point = varying(pivot.add(turned)).xy.sub(center.xy).div(5.2).add(0.5);
  const distance = logoBoxes
    .map(([left, bottom, right, top]) => {
      const offset = abs(point.sub(vec2((left + right) / 2, (bottom + top) / 2))).sub(
        vec2((right - left) / 2, (top - bottom) / 2)
      );
      return offset.max(0).length().add(offset.x.max(offset.y).min(0));
    })
    .reduce((nearest, box) => nearest.min(box), float(10));
  const edge = distance.sub(timing.w.mul(0.008).add(0.004));
  const feather = fwidth(edge).max(0.0001);
  const inside = smoothstep(feather.negate(), feather, edge).oneMinus();
  const material = {
    position: pivot.add(turned),
    opacity: presence.mul(covered.oneMinus()).mul(mix(1, inside, smoothstep(0.65, 1, flight))),
    // Subtle ink differences keep overlapping scraps legible in the assembled collage
    color: vec3(timing.w.mul(0.1).mul(travel)),
  };

  useFrame(() => {
    const previous = heard.current.progress;
    heard.current.progress = progress.value;
    if (!mesh.current || !shards) return;
    if (!shards.hasAttribute('position')) {
      if (words.current.some(({ text }) => !text || text.commitState().status !== 'committed'))
        return;
      const geometries: BufferGeometry[] = [];
      const lines: WordBounds[] = [];
      for (const { word, y, text } of words.current) {
        const outline = createWordGeometry(font, word, text!.glyphs(), 0, y);
        if (outline) {
          outline.computeBoundingBox();
          const { min, max } = outline.boundingBox!;
          lines.push({ left: min.x, right: max.x, bottom: min.y, top: max.y });
          geometries.push(outline);
        }
      }
      if (geometries.length === 0) return;
      const outlines = mergeGeometries(geometries);
      const pieces = createShardGeometry(outlines, 5.2, { lines });
      const centers = pieces.getAttribute('center');
      const timings = pieces.getAttribute('timing');
      const landings = pieces.getAttribute('landing');
      const seen = new Set<string>();
      const arrivals: { at: number; pan: number }[] = [];
      heard.current.releases = lines.map(() => Infinity);
      for (let vertex = 0; vertex < centers.count; vertex += 3) {
        const key = `${centers.getX(vertex)},${centers.getY(vertex)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const row = lines.findIndex(
          ({ bottom, top }) => centers.getY(vertex) >= bottom && centers.getY(vertex) <= top
        );
        if (row >= 0)
          heard.current.releases[row] = Math.min(heard.current.releases[row]!, timings.getX(vertex));
        arrivals.push({
          at: timings.getX(vertex) + timings.getY(vertex),
          pan: landings.getX(vertex) / 5.2,
        });
      }
      arrivals.sort((a, b) => a.at - b.at);
      // A handful of representative landings gives the assembly detail without voicing every scrap
      heard.current.arrivals = Array.from(
        { length: Math.min(10, arrivals.length) },
        (_, index) => arrivals[Math.floor((index / Math.min(10, arrivals.length)) * arrivals.length)]!
      );
      heard.current.finished = arrivals.at(-1)?.at ?? 1;
      shards.copy(pieces);
      pieces.dispose();
      outlines.dispose();
      for (const geometry of geometries) geometry.dispose();
      void warmUp(renderer, mesh.current, camera, scene);
    }
    mesh.current.visible = presence.value > 0;
    if (!active || progress.value <= previous || covered.value > 0) return;
    const cue = soundActions(world).cueSound;
    // Follow the visible frame clock so cues stop when leaving and stay aligned through slow frames
    for (const [index, at] of heard.current.releases.entries()) {
      if (previous >= at || progress.value < at) continue;
      cue('rustle', -0.3, 0.92 + index * 0.04, 0.025);
    }
    for (let index = 0; index < heard.current.arrivals.length; index++) {
      const { at, pan } = heard.current.arrivals[index]!;
      if (previous >= at || progress.value < at) continue;
      cue('rustle', pan, 1.8 + (index % 3) * 0.15, 0.016);
    }
    if (previous < heard.current.finished && progress.value >= heard.current.finished)
      cue('chime', 0, pitch(-10), 0.04);
  });

  if (!shards) return null;

  return (
    <mesh
      ref={mesh}
      name="principle-shards"
      geometry={shards}
      frustumCulled={false}
      renderOrder={-0.5}
      visible={false}
    >
      <meshBasicNodeMaterial
        colorNode={material.color}
        positionNode={material.position}
        opacityNode={material.opacity}
        depthTest={false}
        depthWrite={false}
        transparent
      />
    </mesh>
  );
}
