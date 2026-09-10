import { useFrame } from '@react-three/fiber/webgpu';
import { useQuery, useQueryFirst, useTarget, useTrait } from 'koota/react';
import { clamp } from 'math';
import { useMemo, useRef, useState } from 'react';
import { time, uv } from 'three/tsl';
import { Vector3, type Group, type Object3D } from 'three/webgpu';
import { currentTeam } from '../../data/profiles.js';
import {
  ActiveScreen,
  Position,
  Profile,
  ProfileFocus,
  Screen,
  Size,
  Timeline,
} from '../../sim/index.js';
import { teamLayout } from '../../sim/team-layout.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';

/**
 * The robot is framed by a rotated bounding box that is larger than the head inside it, so a
 * link stopping at the portraits' radius would hang in the air short of the face. Tuck the
 * robot's links in to its silhouette instead.
 */
const robotInset = 0.72;

/** A soft network follows the settled team, with links stopping at each portrait's edge. */
export function TeamConnections({ story = false }: { story?: boolean }) {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
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
  const profiles = useQuery(Profile, Position, ProfileFocus, Size);
  const members = useMemo(
    () =>
      data?.surroundingProfiles.map((login) =>
        profiles.find((entity) => entity.get(Profile)!.login === login)
      ) ?? [],
    [profiles, data?.surroundingProfiles]
  );
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
  const group = useRef<Group>(null);
  const robot = useRef<Object3D | undefined>(undefined);
  const [point] = useState(() => new Vector3());
  const nodePositions = useRef(
    Array.from({ length: teamLayout.profiles.length + 1 }, () => ({ x: 0, y: 0, radius: 0 }))
  );

  useFrame(
    (state) => {
      if (!group.current) return;
      group.current.visible = opacity.value > 0;
      if (!group.current.visible) return;
      const nodes = nodePositions.current;
      const depth = state.camera.position.z - 15;
      point.set(state.camera.position.x, state.camera.position.y, depth);
      const framing = state.viewport.getCurrentViewport(state.camera, point);
      group.current.position.copy(point);
      // Freeze the network during its exit so departing portraits do not stretch the links.
      if (visible) {
        for (let index = 0; index < teamLayout.profiles.length; index++) {
          const member = members[index];
          if (!member) {
            group.current.visible = false;
            return;
          }
          const position = member.get(Position)!;
          if (position.z >= state.camera.position.z - 0.1) {
            group.current.visible = false;
            return;
          }
          point.set(position.x, position.y, position.z).project(state.camera);
          nodes[index].x = point.x * framing.width * 0.5;
          nodes[index].y = point.y * framing.height * 0.5;
          nodes[index].radius =
            (member.get(Size)!.radius * member.get(ProfileFocus)!.scale * 15) /
            (state.camera.position.z - position.z);
        }
        robot.current ??= state.scene.getObjectByName('robot-team-center');
        if (!robot.current) {
          group.current.visible = false;
          return;
        }
        robot.current.updateWorldMatrix(true, false);
        robot.current.getWorldPosition(point);
        if (point.z >= state.camera.position.z - 0.1) {
          group.current.visible = false;
          return;
        }
        point.project(state.camera);
        nodes[teamLayout.profiles.length].x = point.x * framing.width * 0.5;
        nodes[teamLayout.profiles.length].y = point.y * framing.height * 0.5;
        nodes[teamLayout.profiles.length].radius =
          framing.height *
          0.5 *
          teamLayout.radius *
          Math.min(1, framing.width / framing.height / 1.5) *
          (data?.charterFocus ? 0.5 : 1) *
          robotInset;
      }
      for (let index = 0; index < connections.length; index++) {
        const [source, to] = connections[index];
        const start = nodes[source];
        const end = nodes[to];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);
        const length = Math.max(0, distance - start.radius - end.radius);
        const link = group.current.children[index];
        const progress = clamp(
          opacity.value * 1.4 - (story ? (index / (connections.length - 1)) * 0.4 : index * 0.025),
          0,
          1
        );
        const middle = (start.radius + length * 0.5) / Math.max(distance, 0.001);
        link.position.set(start.x + dx * middle, start.y + dy * middle, 0);
        link.rotation.z = Math.atan2(dy, dx);
        link.scale.set(length * progress, framing.height * 0.018, 1);
      }
    },
    { priority: -0.7 }
  );

  return (
    <group ref={group} visible={false} name={story ? 'story-connections' : 'team-connections'}>
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
