import { useFrame, useLoader } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp, lerp } from 'math';
import { easing } from 'math/time';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { color, lights, smoothstep, uniform, uv } from 'three/tsl';
import {
  AdditiveBlending,
  Box3,
  Euler,
  Group,
  Matrix4,
  MeshStandardNodeMaterial,
  PointLight,
  SpotLight,
  type Mesh,
} from 'three/webgpu';
import { ActiveScreen, Screen, Time, Timeline } from '../../sim/index.js';
import { brand } from '../../theme.js';

useLoader.preload(GLTFLoader, './meshes/robot_emoji_apple/scene.gltf');

/** A looming silhouette resolves into a face before its eyes wake up. */
export function RobotReveal() {
  const gltf = useLoader(GLTFLoader, './meshes/robot_emoji_apple/scene.gltf');
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const visible = data?.robotVisible ?? false;
  const warping = data?.warpVisible ?? false;
  const timing = useTrait(timeline, Timeline);
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const motion = useRef({ value: 0, from: 0, target: 0, rise: 0, exitY: 0 });
  const [opacity] = useState(() => uniform(0));
  const [eyes] = useState(() => uniform(0));
  const [flare] = useState(() => uniform(0));
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const materials: MeshStandardNodeMaterial[] = [];
    const lighting = new Group();
    lighting.matrixAutoUpdate = false;
    const uplight = new SpotLight('#7fdfff', 8, 0, 0.72, 0.25, 0);
    uplight.position.set(-1.8, -4.5, 3);
    uplight.target.position.set(0, 0.7, 1.6);
    uplight.castShadow = true;
    uplight.shadow.mapSize.set(2048, 2048);
    uplight.shadow.bias = -0.0001;
    uplight.shadow.radius = 1.5;
    const rim = new PointLight(brand.orange, 3, 0, 0);
    rim.position.set(4, 1, 0.4);
    const fill = new PointLight(brand.purple, 0.25, 0, 0);
    fill.position.set(2, -3, 4);
    lighting.add(uplight, uplight.target, rim, fill);
    const illumination = lights([uplight, rim, fill]);
    scene.rotation.y = -Math.PI / 2;
    scene.position.y = -2.2;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const material = new MeshStandardNodeMaterial({
        color: '#485361',
        metalness: 0.7,
        roughness: 0.32,
        transparent: true,
        toneMapped: false,
      });
      material.opacityNode = opacity;
      material.lightsNode = illumination;
      material.envNode = color('#05070f');
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = -12;
      materials.push(material);
    });
    const bounds = new Box3()
      .setFromObject(scene)
      .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(0.16, -0.05, -0.015)));
    return { scene, materials, bounds, lighting, uplight };
  }, [gltf, opacity]);
  useEffect(
    () => () => {
      model.materials.forEach((material) => material.dispose());
      model.uplight.dispose();
    },
    [model]
  );

  useLayoutEffect(() => {
    motion.current.from = motion.current.value;
    motion.current.target = visible ? 1 : 0;
    motion.current.exitY = head.current?.position.y ?? 0;
    if (visible && motion.current.value === 0) motion.current.rise = 0;
  }, [visible, warping, timing]);

  useFrame(
    (state) => {
      if (!root.current || !head.current) return;
      const now = world.get(Time)!.elapsed;
      const elapsed = now - (timing?.startedAt ?? 0);
      const reveal = motion.current;
      reveal.value = visible
        ? 1
        : warping
          ? elapsed < 1.4
            ? reveal.from
            : 0
          : lerp(reveal.from, reveal.target, easing.cubicInOut(clamp(elapsed / 0.8, 0, 1)));
      root.current.visible = reveal.value > 0;
      if (!root.current.visible) return;
      if (visible) reveal.rise = Math.max(reveal.rise, clamp((elapsed - 0.15) / 3.05, 0, 1));
      const rise = easing.cubicOut(reveal.rise);
      const depth = -1800;
      const framing = state.viewport.getCurrentViewport(state.camera, [0, 0, depth]);
      // Account for the face projecting forward from the model's center as it grows.
      const size =
        (framing.width * 1.22) /
        (4.1 + (framing.width / (state.camera.position.z - depth)) * 2.3 * 1.22);
      // Keep the entire tilted model below the lower frustum plane before the rise.
      const belowFrame =
        -framing.height * 0.54 -
        size *
          0.9 *
          (model.bounds.max.y -
            (model.bounds.min.z * framing.height) / (2 * (state.camera.position.z - depth)));
      head.current.scale.setScalar(size * lerp(0.9, 1, rise));
      head.current.position.set(
        Math.sin(now * 0.12) * size * 0.0015,
        lerp(belowFrame, framing.height * 0.05, rise) + Math.sin(now * 0.18) * size * 0.0015,
        depth
      );
      head.current.rotation.set(lerp(0.16, 0.1, rise), lerp(-0.05, -0.025, rise), -0.015);
      if (warping) {
        const approach = easing.cubicIn(clamp(elapsed / 1.05, 0, 1));
        const fall = easing.cubicIn(clamp((elapsed - 0.9) / 0.5, 0, 1));
        head.current.position.y = lerp(reveal.exitY, belowFrame * 1.3, fall);
        head.current.position.z +=
          Math.max(0, state.camera.position.z - depth - size * model.bounds.max.z) * 0.72 * approach;
        head.current.rotation.x += fall * 0.2;
      }
      // A private light rig follows the head without lighting the foreground packages.
      head.current.updateWorldMatrix(true, false);
      model.lighting.matrix.copy(head.current.matrixWorld);
      model.lighting.updateMatrixWorld(true);
      // Shadow cameras and TSL uniforms hold mutable render state outside React.
      /* oxlint-disable react/immutability */
      model.uplight.shadow.camera.near = size * 0.5;
      model.uplight.shadow.camera.far = size * 12;
      model.uplight.shadow.camera.updateProjectionMatrix();
      model.uplight.shadow.normalBias = size * 0.0015;
      const ignition = easing.cubicOut(clamp((reveal.rise - 0.55) / 0.22, 0, 1));
      const flash = Math.sin(clamp((reveal.rise - 0.6) / 0.2, 0, 1) * Math.PI);
      opacity.value = reveal.value;
      eyes.value = ignition * reveal.value * (0.94 + Math.sin(now * 1.4) * 0.06);
      flare.value = (ignition * 0.12 + flash * 0.88) * reveal.value;
      /* oxlint-enable react/immutability */
    },
    { priority: -0.6 }
  );

  return (
    <group ref={root} name="robot-reveal" visible={false}>
      <group ref={head} name="robot-head" position={[0, -1500, -1800]}>
        <primitive object={model.scene} dispose={null} />
        {[-1.04, 1.06].map((x, index) => (
          <group key={x} name={`robot-eye-${index}`} position={[x, 0.26, 2.28]}>
            <mesh renderOrder={-11}>
              <circleGeometry args={[0.22, 48]} />
              <meshBasicNodeMaterial
                colorNode={color('#ffd8c5').mul(1.5)}
                opacityNode={eyes.mul(smoothstep(1, 0.78, uv().sub(0.5).mul(2).length()))}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh renderOrder={-11} position={[0, 0, 0.02]}>
              <planeGeometry args={[2.8, 2.8]} />
              <meshBasicNodeMaterial
                color="#ff3426"
                opacityNode={uv()
                  .sub(0.5)
                  .mul(2)
                  .length()
                  .mul(-9)
                  .exp()
                  .mul(smoothstep(1, 0.65, uv().sub(0.5).mul(2).length()))
                  .mul(eyes)
                  .mul(2.2)}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh renderOrder={-11} position={[0, 0, 0.04]}>
              <planeGeometry args={[8, 0.24]} />
              <meshBasicNodeMaterial
                color="#ff5b41"
                opacityNode={uv()
                  .sub(0.5)
                  .mul(2)
                  .abs()
                  .oneMinus()
                  .clamp()
                  .pow(2)
                  .x.mul(uv().y.sub(0.5).abs().mul(-18).exp())
                  .mul(flare)}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
