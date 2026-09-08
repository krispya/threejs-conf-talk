import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import type { Entity } from 'koota';
import { useTrait } from 'koota/react';
import { useRef, useState } from 'react';
import { SRGBColorSpace, type Group } from 'three/webgpu';
import { packages } from '../../data/packages.js';
import { allProfiles } from '../../data/profiles.js';
import { Package } from '../../sim/index.js';
import { ramp } from '../../theme.js';
import { placeMaintainerPortrait } from '../package-maintainer-layout.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

export function PackageMaintainers({
  entity,
  visible,
  width,
  height,
}: {
  entity: Entity;
  visible: boolean;
  width: number;
  height: number;
}) {
  const { name, index } = useTrait(entity, Package)!;
  const opacity = useTransitionOpacity(visible, { duration: 0.65 });
  const leads = packages.find((pkg) => pkg.name === name)?.leadMaintainers;

  return (
    <group name="package-maintainers" renderOrder={3}>
      {leads?.map((login, leadIndex) => (
        <MaintainerPortrait
          key={login}
          name={name}
          profile={allProfiles.find((profile) => profile.login === login)!}
          packageIndex={index}
          index={leadIndex}
          count={leads.length}
          width={width}
          height={height}
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function MaintainerPortrait({
  name,
  profile,
  packageIndex,
  index,
  count,
  width,
  height,
  opacity,
}: {
  name: string;
  profile: (typeof allProfiles)[number];
  packageIndex: number;
  index: number;
  count: number;
  width: number;
  height: number;
  opacity: ReturnType<typeof useTransitionOpacity>;
}) {
  const texture = useTexture(profile.avatar, (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  const group = useRef<Group>(null);
  const [placement] = useState(() => new Float32Array(4));

  useFrame(
    (state) => {
      const portrait = group.current;
      if (!portrait) return;
      portrait.visible = opacity.value > 0;
      if (!portrait.visible) return;

      placeMaintainerPortrait(
        placement,
        width,
        height,
        0.22,
        packageIndex,
        index,
        count,
        state.elapsed
      );
      portrait.visible = placement[3] > 0;
      portrait.position.set(placement[0], placement[1], placement[2]);
      portrait.scale.setScalar(placement[3] * (0.85 + opacity.value * 0.15));
    },
    { priority: 0.1 }
  );

  return (
    <group ref={group} name={`maintainer-${name}-${profile.login}`} visible={false} renderOrder={3}>
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
