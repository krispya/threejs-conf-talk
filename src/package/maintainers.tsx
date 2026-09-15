import { useTexture } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useTrait } from 'koota/react';
import { SRGBColorSpace, type Group } from 'three/webgpu';
import { packages } from './data.js';
import { allProfiles } from '../profile/data.js';
import { MaintainerParts, Package } from './traits.js';
import { ramp } from '../theme.js';
import { useTraitBinding } from '../view/hooks.js';
import { useTransitionOpacity } from '../transition/use-transition-opacity.js';

export function PackageMaintainers({ entity, visible }: { entity: Entity; visible: boolean }) {
  const { name } = useTrait(entity, Package)!;
  const opacity = useTransitionOpacity(visible, { duration: 0.65 });
  const leads = packages.find((pkg) => pkg.name === name)?.leadMaintainers;
  // placeMaintainerPortraits drifts each portrait along the label while the fade reveals it
  const parts = { opacity, groups: [] as (Group | null)[] };
  const bind = useTraitBinding(entity, MaintainerParts, parts);

  return (
    <group name="package-maintainers" renderOrder={3}>
      {leads?.map((login, index) => (
        <MaintainerPortrait
          key={login}
          name={name}
          profile={allProfiles.find((profile) => profile.login === login)!}
          opacity={opacity}
          onMount={bind('groups', index)}
        />
      ))}
    </group>
  );
}

function MaintainerPortrait({
  name,
  profile,
  opacity,
  onMount,
}: {
  name: string;
  profile: (typeof allProfiles)[number];
  opacity: ReturnType<typeof useTransitionOpacity>;
  onMount: (group: Group | null) => void;
}) {
  const texture = useTexture(profile.avatar, (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });

  return (
    <group ref={onMount} name={`maintainer-${name}-${profile.login}`} visible={false} renderOrder={3}>
      <mesh renderOrder={0}>
        <circleGeometry args={[1.075, 48]} />
        <meshBasicNodeMaterial
          color={ramp['light-25']}
          opacityNode={opacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={1}>
        <circleGeometry args={[1, 48]} />
        <meshBasicNodeMaterial
          map={texture}
          opacityNode={opacity}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
