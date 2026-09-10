import { useFrame, useTexture } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait } from 'koota/react';
import { useLayoutEffect, useRef } from 'react';
import { SRGBColorSpace, type Group } from 'three/webgpu';
import { ActiveScreen, Screen, Timeline } from '../../sim/index.js';

useTexture.preload('./history/reserved.png');
useTexture.preload('./history/logos.png');
useTexture.preload('./history/name.png');

/** Each new page covers the earlier pages, which stay in place until peeled away. */
export function HistoryRenderer() {
  return (
    <>
      <HistoryPage index={0} source="logos" />
      <HistoryPage index={1} source="name" />
      <HistoryPage index={2} source="reserved" />
    </>
  );
}

/**
 * A sheet of paper tossed onto the table. It is a small rigid body in the sheet
 * plane: constant kinetic friction bleeds off the slide and the spin once it
 * touches down, and the screen edges are walls it rebounds from with a little
 * energy loss and a kick of spin. Arrivals are aimed past the left wall so the
 * sheet slams into it and settles back near the middle. Exits are flicked away
 * with no friction so they always clear the screen.
 */
function HistoryPage({ index, source }: { index: number; source: string }) {
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const visible = (data?.historyPages ?? 0) > index;
  const target = visible ? 0 : data?.id === 'work' ? -1 : 1;
  const body = useRef({
    active: false,
    leaving: false,
    launched: false,
    entered: false,
    elapsed: 0,
    delay: 0,
    direction: -1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: 0,
    spin: 0,
  });
  const texture = useTexture(`./history/${source}.png`, (image) => {
    image.colorSpace = SRGBColorSpace;
  });
  const image = texture.image as HTMLImageElement;
  const width = Math.min(8.6, (5.2 * image.width) / image.height);
  const height = (width * image.height) / image.width;
  const root = useRef<Group>(null);
  const sheet = useRef<Group>(null);

  useLayoutEffect(() => {
    const state = body.current;
    if (!visible && !state.active) return;
    state.active = true;
    state.leaving = !visible;
    state.launched = false;
    state.entered = false;
    state.elapsed = 0;
    // The stack peels off top sheet first when it gets tossed away
    state.delay = visible ? 0 : (2 - index) * 0.06;
    state.direction = visible ? -1 : target;
  }, [visible, target, index]);

  useFrame(
    (state, delta) => {
      if (!root.current || !sheet.current) return;
      const toss = body.current;
      root.current.visible = toss.active;
      if (!root.current.visible) return;

      const viewport = state.viewport.getCurrentViewport(state.camera, root.current.position);
      const scale =
        source === 'name'
          ? Math.min(
              (viewport.width * 0.96) / (width + height * 0.028),
              (viewport.height * 1.2) / (height + width * 0.028)
            )
          : Math.min((viewport.width * 0.91) / 9.5, (viewport.height * 0.91) / 6);
      root.current.scale.setScalar(scale);
      const halfWidth = viewport.width / (2 * scale);
      const halfHeight = viewport.height / (2 * scale);
      const offscreen = halfWidth + Math.hypot(width, height) / 2 + 0.4;
      // The screen edges are walls, letting a sliver of the sheet hang past them
      const minX = Math.min(-halfWidth + width * 0.42, 0);
      const maxX = Math.max(halfWidth - width * 0.42, 0);
      const minY = -halfHeight + height * 0.42;
      const maxY = halfHeight - height * 0.42;

      // Sliding deceleration and spin deceleration from table friction
      const friction = 30;
      const spinFriction = 5;
      const aimX = (index - 1) * 0.18;
      const aimY = (1 - index) * 0.28;

      toss.elapsed += Math.min(delta, 1 / 30);
      if (!toss.launched && toss.elapsed >= toss.delay) {
        toss.launched = true;
        if (toss.leaving) {
          // Snatched up and flicked clear, with a bit of lift and a twist from the wrist
          toss.vx = toss.direction * 26;
          toss.vy = 2.5;
          toss.vz = 6;
          toss.spin += toss.direction * -1.4;
        } else {
          // Aim past the left wall so the sheet hits it with speed to spare and the
          // rebound carries it back to the aim point. The wall keeps 0.85 of the
          // impact speed, and the discrete friction steps trim the return slide
          // to a measured 0.64 of the overshoot
          toss.angle = index % 2 === 0 ? -0.42 : 0.38;
          toss.x = offscreen;
          toss.y = aimY + 0.55;
          toss.z = 1;
          toss.vz = 0;
          // Spin freely while falling and through the landing hop, then friction
          // unwinds the rest to lie flat
          const airtime = Math.sqrt((2 * toss.z) / 55) * (1 + 2 * 0.22);
          const turn = Math.abs(toss.angle);
          toss.spin =
            -Math.sign(toss.angle) *
            spinFriction *
            (Math.sqrt(airtime * airtime + (2 * turn) / spinFriction) - airtime);
          const overshoot = Math.max((aimX - minX) / 0.64, 0.35);
          const dx = minX - overshoot - toss.x;
          const dy = aimY - toss.y;
          const distance = Math.hypot(dx, dy);
          // Nothing slows the sheet until it lands, so the release speed covers the
          // airborne stretch at full speed and the rest as a friction slide
          const speed =
            friction * (Math.sqrt(airtime * airtime + (2 * distance) / friction) - airtime);
          toss.vx = (dx / distance) * speed;
          toss.vy = (dy / distance) * speed;
        }
      }

      if (toss.launched) {
        const steps = 2;
        const dt = Math.min(delta, 1 / 30) / steps;
        for (let step = 0; step < steps; step++) {
          if (toss.leaving) {
            toss.z += (1 - toss.z) * Math.min(1, dt * 14);
          } else {
            toss.vz -= 55 * dt;
            toss.z += toss.vz * dt;
            if (toss.z <= 0) {
              toss.z = 0;
              // A faint hop on touchdown, then the sheet stays flat
              toss.vz = toss.vz < -0.6 ? -toss.vz * 0.22 : 0;
            }
            if (toss.z === 0) {
              const speed = Math.hypot(toss.vx, toss.vy);
              const slowed = Math.max(0, speed - friction * dt);
              const ratio = speed > 0.05 ? slowed / speed : 0;
              toss.vx *= ratio;
              toss.vy *= ratio;
              // Friction torque bleeds off spin, and a stopped slide pins the sheet
              const spinning = Math.max(0, Math.abs(toss.spin) - spinFriction * dt);
              toss.spin = ratio === 0 || spinning < 0.02 ? 0 : Math.sign(toss.spin) * spinning;
            }
          }
          toss.x += toss.vx * dt;
          toss.y += toss.vy * dt;
          toss.angle += toss.spin * dt;
          if (toss.leaving) continue;
          if (!toss.entered) {
            toss.entered = toss.x <= maxX;
            continue;
          }

          // Rebounds keep most of the impact speed, scrub the sliding component,
          // and add a kick of spin from the off-center hit
          const bounce = (normalX: number, normalY: number) => {
            const impact = -(toss.vx * normalX + toss.vy * normalY);
            if (impact <= 0) return;
            const along = toss.vx * -normalY + toss.vy * normalX;
            toss.vx = normalX * impact * 0.85 + -normalY * along * 0.68;
            toss.vy = normalY * impact * 0.85 + normalX * along * 0.68;
            const bias = normalX !== 0 ? Math.sign(normalX) : -Math.sign(normalY);
            const twist = toss.spin !== 0 ? Math.sign(toss.spin) : bias;
            toss.spin += bias * along * 0.03 + twist * impact * 0.07;
          };
          if (toss.x < minX) {
            toss.x = minX;
            bounce(1, 0);
          } else if (toss.x > maxX) {
            toss.x = maxX;
            bounce(-1, 0);
          }
          // A sheet nearly as tall as the screen is meant to overflow, so it gets no floor or ceiling
          if (maxY - minY > 0.6) {
            if (toss.y < minY) {
              toss.y = minY;
              bounce(0, 1);
            } else if (toss.y > maxY) {
              toss.y = maxY;
              bounce(0, -1);
            }
          }
        }
        if (toss.leaving && Math.abs(toss.x) > offscreen * 1.3) {
          toss.active = false;
          root.current.visible = false;
          return;
        }
      }

      sheet.current.position.set(toss.x, toss.y, index * 0.04);
      sheet.current.scale.setScalar(1 + toss.z * (toss.leaving ? 0.22 : 0.14));
      // Airborne the leading edge rides high, then the sheet lies flat on landing
      const heading = toss.vx !== 0 ? Math.sign(toss.vx) : toss.direction;
      sheet.current.rotation.set(toss.z * 0.22, -heading * toss.z * 0.5, toss.angle);
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name={`history-${source}`} position={[0, 0, -10]} visible={false}>
      <group ref={sheet}>
        <mesh renderOrder={20 + index}>
          <planeGeometry args={[width, height]} />
          <meshBasicNodeMaterial
            map={texture}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
