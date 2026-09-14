import { useActiveScreen } from '../timeline/hooks.js';
import { useMemo } from 'react';
import { time, uv } from 'three/tsl';
import type { Group, Object3D } from 'three/webgpu';
import { currentTeam } from './data.js';
import { TeamNetwork } from './traits.js';
import { teamLayout } from './utils/layout.js';
import { useSpawnedParts } from '../view/hooks.js';
import { useTransitionOpacity } from '../view/use-transition-opacity.js';

/**
 * A soft network follows the settled team, with links stopping at each portrait's edge.
 * `layoutTeamConnections` places the links after every view has settled for the frame.
 */
export function TeamConnections({ story = false }: { story?: boolean }) {
  const { data } = useActiveScreen();
  const connections = useMemo(() => {
    if (!story) return teamLayout.connections;
    const source = currentTeam.indexOf('krispya');
    return [
      ...teamLayout.connections,
      ...Array.from(
        { length: currentTeam.length + 1 },
        (_, target) => [source, target] as const
      ).filter(
        ([from, to]) =>
          from !== to &&
          !teamLayout.connections.some(
            ([a, b]) => (a === from && b === to) || (a === to && b === from)
          )
      ),
    ];
  }, [story]);
  const visible = story
    ? !!data?.storyConnectionsVisible
    : !!data?.robotFriendly && !data.charterVisible && !data.announcementVisible;
  const opacity = useTransitionOpacity(visible, {
    delay: visible ? (story ? 0.15 : (data?.robotJoinDelay ?? 0) + 2.5) : 0,
    duration: visible ? 2.3 : 0.6,
  });
  const glow = useMemo(() => {
    const distance = uv().y.sub(0.5).mul(2).pow(2);
    return distance
      .mul(-180)
      .exp()
      .mul(0.55)
      .add(distance.mul(-8).exp().mul(0.16))
      .mul(opacity)
      .mul(time.mul(0.8).sin().mul(0.06).add(0.94));
  }, [opacity]);
  const network = useMemo(
    () => ({
      group: null as Group | null,
      opacity,
      story,
      connections,
      nodes: Array.from({ length: teamLayout.profiles.length + 1 }, () => ({
        x: 0,
        y: 0,
        radius: 0,
      })),
      robot: undefined as Object3D | undefined,
    }),
    [opacity, story, connections]
  );
  const bind = useSpawnedParts(TeamNetwork, network);

  return (
    <group
      ref={bind('group')}
      visible={false}
      name={story ? 'story-connections' : 'team-connections'}
    >
      {connections.map(([from, to]) => (
        <mesh key={`${from}-${to}`} renderOrder={-4} frustumCulled={false}>
          <planeGeometry />
          <meshBasicNodeMaterial
            color="#e7edff"
            opacityNode={glow}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
