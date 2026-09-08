import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useHas, useQuery, useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { lerp } from 'math';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { SRGBColorSpace, type Group, type MeshBasicMaterial } from 'three/webgpu';
import { profiles } from '../../data/profiles.js';
import {
  Anchor,
  ActiveScreen,
  getRevealProgress,
  getTransitionProgress,
  Hidden,
  Profile,
  ProfileFocus,
  Ref,
  Screen,
  Size,
  Timeline,
} from '../../sim/index.js';
import { ramp } from '../../theme.js';

for (const profile of profiles) useTexture.preload(profile.avatar);

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
  const timing = useTrait(timeline, Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const focusing = Boolean(useTrait(screen, Screen)?.focusedProfile);
  const visible = !useHas(entity, Hidden);
  const [present, setPresent] = useState(visible);
  const progress = useRef(visible ? 1 : 0);
  const transition = useRef({ from: visible ? 1 : 0, target: visible ? 1 : 0 });
  const groupRef = useRef<Group>(null);
  const portraitRef = useRef<MeshBasicMaterial>(null);
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
    if (borderRef.current) borderRef.current.opacity = progress.current * 0.7;
  }, [visible, timing]);

  useFrame(
    () => {
      const group = groupRef.current;
      const portrait = portraitRef.current;
      const border = borderRef.current;
      const { from, target } = transition.current;
      if (!group || !portrait || !border) return;

      progress.current = lerp(
        from,
        target,
        focusing ? getRevealProgress(world) : getTransitionProgress(world)
      );
      group.scale.setScalar(
        Math.max(0.001, progress.current * (entity.get(ProfileFocus)?.scale ?? 1))
      );
      portrait.opacity = progress.current;
      border.opacity = progress.current * 0.7;

      if (progress.current === 0) {
        group.visible = false;
        setPresent(false);
      }
    },
    { priority: -0.5, enabled: present }
  );

  return (
    <group ref={handleInit} name={login} visible={present}>
      <mesh renderOrder={-3}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          ref={portraitRef}
          map={texture}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.01]} renderOrder={-3}>
        <ringGeometry args={[radius, radius + 0.025, 64]} />
        <meshBasicMaterial
          ref={borderRef}
          color={ramp['light-25']}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
