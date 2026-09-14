import { Size } from '../traits.js';
import { useActiveScreen } from '../timeline/hooks.js';
import { useQuery, useTrait } from 'koota/react';
import { Profile, ProfileParts, ProfilePresence } from './traits.js';
import {
  useViewBinding,
  useEntityVisible,
  useEntityPresent,
  useTraitBinding,
} from '../view/hooks.js';
import { Anchor } from '../floating/traits.js';
import { useTexture, useThree } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { easing } from 'math/time';
import { useCallback, useEffect, useMemo } from 'react';
import { color, mix, texture as textureNode, uniform } from 'three/tsl';
import {
  SRGBColorSpace,
  type Group,
  type MeshBasicMaterial,
  type MeshBasicNodeMaterial,
} from 'three/webgpu';
import { allProfiles } from './data.js';
import { ramp } from '../theme.js';
import { useTransitionOpacity } from '../view/use-transition-opacity.js';
import { ProfileAura } from './aura.js';

export function ProfileRenderer() {
  const profiles = useQuery(Profile, Size);
  const { data } = useActiveScreen();

  return (
    <group name="contributors">
      {profiles.map((entity) => (
        <ProfileView key={entity} entity={entity} storyProfile={data?.storyProfile ?? ''} />
      ))}
    </group>
  );
}

for (const profile of allProfiles) useTexture.preload(profile.avatar);

/**
 * The portrait and its ring. `animateProfiles` scales and fades the registered parts from the
 * presence the presentation action captured, and releases the view once it has left.
 */
function ProfileView({ entity, storyProfile }: { entity: Entity; storyProfile: string }) {
  const { login, avatar } = useTrait(entity, Profile)!;
  const { radius } = useTrait(entity, Size)!;
  const texture = useTexture(avatar, (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  // Decode and upload the portrait ahead of the frame the contributors first appear on
  const renderer = useThree((state) => state.renderer);
  useEffect(() => {
    if (renderer.hasInitialized()) renderer.initTexture(texture);
  }, [renderer, texture]);
  // Receded portraits sink toward the backdrop so the portraits in front stay the bright ones
  const dim = useMemo(() => uniform(0), []);
  const portraitColor = useMemo(() => {
    const image = textureNode(texture);
    // Transparent avatar pixels belong to the portrait's white backing, not the video wall.
    return mix(mix(color('#ffffff'), image.rgb, image.a), color('#141726'), dim);
  }, [texture, dim]);
  const featured = storyProfile === login;
  const visible = useEntityVisible(entity);
  const present = useEntityPresent(entity);
  const storytelling = visible && featured;
  const auraReveal = useTransitionOpacity(storytelling, {
    duration: storytelling ? 1.8 : 0.55,
    delay: storytelling ? 0.3 : 0,
    ease: easing.cubicInOut,
  });
  const parts = useMemo(
    () => ({
      portrait: null as MeshBasicNodeMaterial | null,
      border: null as MeshBasicMaterial | null,
      dim,
      aura: null as Group | null,
      auraReveal,
    }),
    [dim, auraReveal]
  );
  const bind = useTraitBinding(entity, ProfileParts, parts);

  const bindView = useViewBinding(entity);
  const handleInit = useCallback(
    (group: Group | null) => {
      if (!group) return;
      const anchor = entity.get(Anchor)!;
      group.position.set(anchor.x, anchor.y, anchor.z);
      group.scale.setScalar(Math.max(0.001, entity.get(ProfilePresence)?.value ?? 0));
      return bindView(group);
    },
    [entity, bindView]
  );

  return (
    <group ref={handleInit} name={login} visible={present}>
      <ProfileAura reveal={auraReveal} radius={radius} onMount={bind('aura')} />
      <mesh renderOrder={featured ? -2 : -3}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicNodeMaterial
          ref={bind('portrait')}
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
          ref={bind('border')}
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
