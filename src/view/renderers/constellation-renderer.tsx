import { useFrame } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useCallback, useMemo } from 'react';
import { color, dot, float, hash, mix, smoothstep, time, uv, vec2 } from 'three/tsl';
import { AdditiveBlending, type Group, type Node } from 'three/webgpu';
import {
  Constellation,
  ActiveScreen,
  ConstellationMember,
  Hidden,
  Position,
  Principle,
  Ref,
  Star,
  Screen,
  Timeline,
} from '../../sim/index.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { ConstellationMap } from './constellation-map.js';

/** Smooth random brightness changes without an obvious repeating pulse. */
function twinkleNoise(value: Node<'float'>) {
  const cell = value.floor();
  const fraction = value.fract();
  const blend = fraction.mul(fraction).mul(float(3).sub(fraction.mul(2)));
  return mix(hash(cell.toInt()), hash(cell.add(1).toInt()), blend);
}

function useEntityRef(entity: Entity) {
  return useCallback(
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
}

export function ConstellationRenderer() {
  const constellations = useQuery(Constellation, Position);
  return constellations.map((entity) => <ConstellationView key={entity} entity={entity} />);
}

function ConstellationView({ entity }: { entity: Entity }) {
  const { id } = useTrait(entity, Constellation)!;
  const stars = useQuery(Star, Principle, ConstellationMember(entity));
  const opacity = useTransitionOpacity(!useHas(entity, Hidden));
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const mapOpacity = useTransitionOpacity(data?.constellation === id && data.constellationMap);
  const handleInit = useEntityRef(entity);

  useFrame(
    () => {
      const group = entity.get(Ref);
      if (group) group.visible = opacity.value > 0;
    },
    { priority: -0.6 }
  );

  return (
    <group ref={handleInit} name={`${id}-constellation`}>
      <ConstellationMap stars={stars} progress={mapOpacity} opacity={opacity} />
      {stars.map((star) => (
        <StarView key={star} entity={star} opacity={opacity} />
      ))}
    </group>
  );
}

function StarView({ entity, opacity }: { entity: Entity; opacity: Node<'float'> }) {
  const { title } = useTrait(entity, Principle)!;
  const star = useTrait(entity, Star)!;
  const handleInit = useEntityRef(entity);
  const glow = useMemo(() => {
    const clock = time.mul(star.twinkleSpeed).add(star.twinklePhase);
    const slow = twinkleNoise(clock);
    const shimmer = twinkleNoise(clock.mul(3.7).add(17.31));
    const scintillation = slow.pow(2).mul(1.5).add(shimmer.pow(3).mul(0.6));
    const brightness = scintillation.add(0.18).mul(star.brightness);
    // Let the halo breathe and the flares catch the brighter moments
    const p = uv().sub(0.5).mul(2).div(scintillation.mul(0.13).add(0.83));
    const radiusSquared = dot(p, p);
    const radius = p.length();
    const core = float(1).sub(smoothstep(0.035, 0.09, radius));
    const halo = radiusSquared.mul(-10).exp().mul(0.48).add(radiusSquared.mul(-3.5).exp().mul(0.035));
    const ringDistance = radius.sub(0.52);
    const ring = ringDistance.mul(ringDistance).mul(-1500).exp().mul(0.055);
    const lens = vec2(
      p.x.mul(Math.cos(star.streakAngle)).add(p.y.mul(Math.sin(star.streakAngle))),
      p.y.mul(Math.cos(star.streakAngle)).sub(p.x.mul(Math.sin(star.streakAngle)))
    );
    // Fine diffraction spikes share the white core's light and fade into the halo
    const streak = lens.y
      .mul(lens.y)
      .mul(-4200)
      .sub(lens.x.abs().mul(3 / star.streakLength))
      .exp()
      .mul(0.18);
    const cross = lens.x
      .mul(lens.x)
      .mul(-4200)
      .sub(lens.y.abs().mul(3.8 / star.streakLength))
      .exp()
      .mul(0.14);
    const rays = streak.add(cross).mul(scintillation.mul(0.7).add(0.35));
    const tint = color(star.color);
    return {
      color: tint
        .mul(halo.add(ring))
        .add(mix(tint, color('#ffffff'), 0.6).mul(rays))
        .add(color('#f1f8ff').mul(core).mul(1.6))
        .mul(brightness),
      opacity: float(1)
        .sub(smoothstep(0.65, 0.98, radius))
        .mul(opacity),
    };
  }, [
    star.color,
    star.brightness,
    star.twinklePhase,
    star.twinkleSpeed,
    star.streakAngle,
    star.streakLength,
    opacity,
  ]);

  return (
    <group ref={handleInit} name={title}>
      <mesh renderOrder={1}>
        <planeGeometry args={[7, 7]} />
        <meshBasicNodeMaterial
          colorNode={glow.color}
          opacityNode={glow.opacity}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
