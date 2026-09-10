import { useFrame } from '@react-three/fiber/webgpu';
import { easing } from 'math/time';
import { useMemo, useRef } from 'react';
import { atan, color, fwidth, hash, mix, smoothstep, time, uv, vec2 } from 'three/tsl';
import type { Group } from 'three/webgpu';
import { useTransitionOpacity } from '../use-transition-opacity.js';

/** Flowing rays, expanding waves, and sparks radiate from the storyteller's portrait. */
export function ProfileAura({ active, radius }: { active: boolean; radius: number }) {
  const reveal = useTransitionOpacity(active, {
    duration: active ? 1.8 : 0.55,
    delay: active ? 0.3 : 0,
    ease: easing.cubicInOut,
  });
  const group = useRef<Group>(null);
  const aura = useMemo(() => {
    const point = uv().sub(0.5).mul(4);
    const distance = point.length();
    const angle = atan(point.y, point.x);
    const outside = smoothstep(1, 1.018, distance);
    const edge = distance.sub(1.035).abs();
    const rim = smoothstep(0.009, fwidth(distance).add(0.016), edge).oneMinus();
    const breath = time.mul(1.4).sin().mul(0.12).add(0.88);
    const glow = edge.mul(-5).exp().mul(0.48).mul(breath);

    // Light travels along irregular rays from the rim and disperses into the background
    const reach = distance.sub(1.035).max(0);
    const flow = reach.mul(15).sub(time.mul(2.6));
    const bend = angle.mul(5).sub(time.mul(0.3)).sin().mul(0.75);
    const beams = angle.mul(19).add(bend).add(reach.mul(0.8)).sin().mul(0.5).add(0.5).pow(7);
    const filaments = angle.mul(43).sub(bend).sub(time.mul(0.12)).sin().mul(0.5).add(0.5).pow(18);
    const rays = beams
      .mul(0.72)
      .add(filaments.mul(0.38))
      .mul(flow.add(angle.mul(3)).sin().mul(0.3).add(0.7))
      .mul(reach.mul(-2.6).exp())
      .mul(smoothstep(0, 0.045, reach));

    const wave = distance.sub(1.06).mul(2.6).sub(time.mul(0.55)).fract().sub(0.5);
    const ripples = wave
      .mul(wave)
      .mul(-850)
      .exp()
      .mul(smoothstep(1.06, 1.16, distance))
      .mul(smoothstep(1.12, 1.8, distance).oneMinus())
      .mul(angle.mul(3).add(time.mul(0.6)).sin().mul(0.2).add(0.8))
      .mul(0.46);

    // Each angular lane carries one spark outward, fading before its next orbit begins
    const lane = angle
      .div(Math.PI * 2)
      .add(0.5)
      .add(time.mul(0.012))
      .fract()
      .mul(48);
    const seed = hash(lane.floor().toUint());
    const life = time.mul(seed.mul(0.1).add(0.18)).add(seed).fract();
    const radial = distance.sub(life.mul(0.7).add(1.08));
    const angular = lane
      .fract()
      .sub(0.5)
      .sub(time.mul(0.8).add(seed.mul(20)).sin().mul(0.16))
      .mul((Math.PI * 2) / 48)
      .mul(distance);
    const spark = vec2(angular, radial).length().div(seed.mul(0.008).add(0.007));
    const core = spark.mul(spark).mul(-1.8).exp();
    const trail = vec2(angular.mul(110), radial.mul(35)).length();
    const sparks = core
      .add(trail.mul(trail).negate().exp().mul(0.2))
      .mul(life.mul(Math.PI).sin().pow(2))
      .mul(seed.mul(0.6).add(0.4));

    const tint = mix(
      mix(color('#b78aff'), color('#73e8ed'), angle.add(time.mul(0.25)).sin().mul(0.5).add(0.5)),
      color('#ffd58a'),
      angle.mul(2).sub(time.mul(0.3)).sin().mul(0.5).add(0.5).pow(3)
    );
    return {
      color: mix(
        tint,
        color('#fff9e8'),
        rim.mul(0.65).add(rays.mul(0.35)).add(core.mul(0.8)).clamp()
      ),
      opacity: rim
        .mul(0.95)
        .add(glow)
        .add(rays)
        .add(ripples)
        .add(sparks)
        .mul(outside)
        .mul(smoothstep(1.75, 1.95, distance).oneMinus())
        .mul(reveal)
        .clamp(0, 1),
    };
  }, [reveal]);

  useFrame(
    () => {
      if (group.current) group.current.visible = reveal.value > 0;
    },
    { priority: -0.6 }
  );

  return (
    <group ref={group} name="story-profile-aura" visible={false}>
      <mesh position={[0, 0, -0.02]} renderOrder={-2.5}>
        <planeGeometry args={[(radius + 0.025) * 4, (radius + 0.025) * 4]} />
        <meshBasicNodeMaterial
          colorNode={aura.color}
          opacityNode={aura.opacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
