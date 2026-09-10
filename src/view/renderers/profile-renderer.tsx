import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useQuery, useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { color, mix, texture as textureNode, uniform } from 'three/tsl';
import {
  Color,
  SRGBColorSpace,
  type Group,
  type MeshBasicMaterial,
  type MeshBasicNodeMaterial,
} from 'three/webgpu';
import { profiles } from '../../data/profiles.js';
import {
  Anchor,
  ActiveScreen,
  getRevealTime,
  getTransitionProgress,
  Profile,
  ProfileFocus,
  Ref,
  Screen,
  Size,
  Timeline,
} from '../../sim/index.js';
import { profileArrival } from '../../sim/profile-arrival.js';
import { ramp } from '../../theme.js';
import { useEntityVisible } from '../use-entity-visible.js';
import { ProfileAura } from './profile-aura.js';

for (const profile of profiles) useTexture.preload(profile.avatar);

// Ring colors for a portrait in front and one that has receded behind the newcomers
const light = new Color(ramp['light-25']);
const shadow = new Color('#141726');

export function ProfileRenderer() {
  const profiles = useQuery(Profile, Size);
  const timeline = useQueryFirst(Timeline);

  return (
    <group name="contributors">
      {profiles.map((entity) => (
        <ProfileView key={entity} entity={entity} timeline={timeline} />
      ))}
    </group>
  );
}

function ProfileView({ entity, timeline }: { entity: Entity; timeline: Entity | undefined }) {
  const world = useWorld();
  const { login, avatar } = useTrait(entity, Profile)!;
  const { radius } = useTrait(entity, Size)!;
  const texture = useTexture(avatar, (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  // Receded portraits sink toward the backdrop so the portraits in front stay the bright ones
  const [dim] = useState(() => uniform(0));
  const portraitColor = useMemo(() => {
    const image = textureNode(texture);
    // Transparent avatar pixels belong to the portrait's white backing, not the video wall.
    return mix(mix(color('#ffffff'), image.rgb, image.a), color('#141726'), dim);
  }, [texture, dim]);
  const timing = useTrait(timeline, Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const screenData = useTrait(screen, Screen);
  const featured = screenData?.storyProfile === login;
  // Ring screens share the ring's staggered spring for their fades
  const focusing = Boolean(screenData?.focusedProfile || screenData?.surroundingProfiles.length);
  const visible = useEntityVisible(entity);
  const [present, setPresent] = useState(visible);
  const progress = useRef(visible ? 1 : 0);
  const transition = useRef({ from: visible ? 1 : 0, target: visible ? 1 : 0 });
  const groupRef = useRef<Group>(null);
  const portraitRef = useRef<MeshBasicNodeMaterial>(null);
  const borderRef = useRef<MeshBasicMaterial>(null);

  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      groupRef.current = group;
      const anchor = entity.get(Anchor)!;
      group.position.set(anchor.x, anchor.y, anchor.z);
      group.scale.setScalar(Math.max(0.001, progress.current));
      entity.add(Ref(group));
      return () => {
        groupRef.current = null;
        if (entity.isAlive()) entity.remove(Ref);
      };
    },
    [entity]
  );

  if (visible && !present) setPresent(true);

  useLayoutEffect(() => {
    transition.current = { from: progress.current, target: visible ? 1 : 0 };
    if (portraitRef.current) portraitRef.current.opacity = progress.current;
    if (borderRef.current) borderRef.current.opacity = progress.current;
  }, [visible, timing]);

  useFrame(
    () => {
      // Auto-advance can reset the clock before React commits the next screen.
      if (world.queryFirst(Timeline)?.get(Timeline)?.startedAt !== timing?.startedAt) return;
      const group = groupRef.current;
      const portrait = portraitRef.current;
      const border = borderRef.current;
      const { from, target } = transition.current;
      if (!group || !portrait || !border) return;

      const focus = entity.get(ProfileFocus);
      const recede = focus?.recede ?? 0;
      // Share the ring's staggered spring so a portrait fades and grows as it travels
      progress.current = lerp(
        from,
        target,
        focusing
          ? profileArrival(getRevealTime(world), focus?.slot ?? -1, focus?.count ?? 0)
          : getTransitionProgress(world)
      );
      group.scale.setScalar(Math.max(0.001, progress.current * (focus?.scale ?? 1)));
      // Receding portraits also thin out, letting the wall read through them. The spring
      // settles past its mark, which belongs in the motion rather than the fade.
      const faded = clamp(progress.current, 0, 1) * (1 - recede * 0.45) * (focus?.wanderOpacity ?? 1);
      group.visible = faded > 0;
      portrait.opacity = faded;
      border.opacity = faded;
      // TSL uniforms carry mutable render state outside React
      /* oxlint-disable react/immutability */
      dim.value = recede * 0.72;
      border.color.lerpColors(light, shadow, dim.value);
      /* oxlint-enable react/immutability */

      // Only retire a portrait once it has faded out. A portrait waiting on a screen's
      // reveal delay also sits at zero, and retiring it there would keep it off screen.
      if (progress.current === 0 && !visible) {
        group.visible = false;
        setPresent(false);
      }
    },
    { priority: -0.5, enabled: present }
  );

  return (
    <group ref={handleInit} name={login} visible={present}>
      <ProfileAura active={visible && featured} radius={radius} />
      <mesh renderOrder={featured ? -2 : -3}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicNodeMaterial
          ref={portraitRef}
          colorNode={portraitColor}
          transparent
          depthTest={!featured}
          depthWrite={!featured}
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.01]} renderOrder={featured ? -2 : -3}>
        <ringGeometry args={[radius, radius + 0.025, 64]} />
        <meshBasicMaterial
          ref={borderRef}
          color={ramp['light-25']}
          transparent
          depthTest={!featured}
          depthWrite={!featured}
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
