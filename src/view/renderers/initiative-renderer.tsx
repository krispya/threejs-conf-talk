import { useFrame, useThree } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp } from 'math';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  atan,
  color,
  mix,
  positionLocal,
  screenSize,
  screenUV,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec4,
} from 'three/tsl';
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  RenderTarget,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { ActiveScreen, Camera, Screen, ScreenTransition, Time, Timeline } from '../../sim/index.js';
import { portalFallMotion } from '../../sim/portal-fall.js';
import { brand } from '../../theme.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';

/** A warp into a glade where an ancient stone portal will preview each initiative. */
export function InitiativeRenderer() {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  useEffect(() => {
    let active = true;
    void new GLTFLoader()
      .loadAsync('./meshes/simple_stone_portal/scene.gltf')
      .then((model) => {
        if (active) setGltf(model);
      })
      .catch(() => {
        // Keep the placeholder available while the destination asset is being added
      });
    return () => {
      active = false;
    };
  }, []);
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const falling = !!data?.initiativePortalVisible;
  const inside = !!data?.initiativesVisible;
  const opacity = useTransitionOpacity(falling || inside, { duration: 0.3 });
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const mesh = useRef<Mesh>(null);
  const lens = useRef<{ camera: PerspectiveCamera; fov: number } | null>(null);
  const [resources] = useState(() => {
    const scene = new Scene();
    scene.background = new Color('#11141d');
    const light = new DirectionalLight('#fff4e5', 3);
    light.position.set(-3, 4, 5);
    const rim = new DirectionalLight('#8adfff', 2);
    rim.position.set(3, 1, -3);
    scene.add(new AmbientLight('#a7b7dc', 0.45), light, rim);
    const camera = new PerspectiveCamera(45, 1, 0.1, 300);
    camera.position.z = 7;
    return {
      scene,
      camera,
      target: new RenderTarget(1, 1, { type: HalfFloatType, samples: 4 }),
      center: uniform(new Vector2(0.5, 0.5)),
      radius: uniform(0),
      glow: uniform(1),
      phase: uniform(0),
      burst: uniform(0),
      spin: uniform(0),
      clearColor: new Color(),
      origin: new Vector3(),
    };
  });
  useLayoutEffect(() => {
    resources.target.setSize(size.width, size.height);
    // The preview camera is independent of the presentation camera
    // oxlint-disable-next-line react/immutability
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  }, [resources, size.width, size.height]);
  useEffect(() => () => resources.target.dispose(), [resources]);
  useEffect(
    () => () => {
      if (lens.current) {
        lens.current.camera.fov = lens.current.fov;
        lens.current.camera.updateProjectionMatrix();
      }
    },
    []
  );
  // The portal is centered and scaled to a known height so the preview camera can frame it
  // regardless of the export's native units
  const portal = useMemo(() => {
    const group = new Group();
    group.name = 'stone-portal';
    if (!gltf) {
      group.add(
        new Mesh(
          new SphereGeometry(1.25, 64, 32),
          new MeshStandardNodeMaterial({ color: '#dba5ff', roughness: 0.3, metalness: 0.15 })
        )
      );
      return group;
    }
    const model = gltf.scene.clone(true);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const scale = 3.4 / size.y;
    model.scale.setScalar(scale);
    model.position.copy(bounds.getCenter(new Vector3())).multiplyScalar(-scale);
    model.position.y -= size.y * scale * 0.05;
    // The export's opening faces along x with the roots on the +x side, so turn that face
    // toward the preview camera
    group.rotation.y = -Math.PI / 2;
    group.add(model);
    return group;
  }, [gltf]);
  useLayoutEffect(() => {
    resources.scene.add(portal);
    return () => {
      resources.scene.remove(portal);
      if (!gltf) {
        const sphere = portal.children[0] as Mesh<SphereGeometry, MeshStandardNodeMaterial>;
        sphere.geometry.dispose();
        sphere.material.dispose();
      }
    };
  }, [resources, portal, gltf]);
  // Build both pipelines during the title screen so the fall never stalls on a first draw
  useEffect(() => {
    warmUp(renderer, resources.scene, resources.camera, undefined, resources.target);
    if (mesh.current) warmUp(renderer, mesh.current, camera, scene);
  }, [renderer, camera, scene, resources, portal]);
  const nodes = useMemo(() => {
    const point = screenUV
      .sub(resources.center)
      .mul(vec2(screenSize.x.div(screenSize.y), 1))
      .mul(2);
    const angle = atan(point.y, point.x).sub(resources.spin);
    const distance = point.length();
    // Scale the warp portal's rim with its projected size as we approach PMNDRS
    const scale = resources.radius.clamp(0.07, 1);
    const ripple = angle
      .mul(7)
      .sub(resources.phase.mul(28))
      .sin()
      .add(angle.mul(13).add(resources.phase.mul(37)).sin().mul(0.4))
      .mul(0.018)
      .mul(resources.phase.mul(Math.PI).sin())
      .add(angle.mul(3).sin().mul(resources.burst).mul(0.16))
      .mul(scale);
    const edge = distance.sub(resources.radius.mul(2)).sub(ripple).div(scale);
    const mask = smoothstep(-0.035, 0.035, edge).oneMinus();
    const halo = edge
      .div(resources.burst.mul(0.075).add(0.09))
      .pow(2)
      .mul(-0.5)
      .exp()
      .mul(resources.glow);
    const core = edge.div(0.014).pow(2).mul(-0.5).exp().mul(resources.glow);
    const surround = edge.sub(0.1).div(0.2).pow(2).mul(-0.5).exp().mul(resources.glow).mul(0.8);
    // Three curved trails make the opening's rotation readable beyond the thin rim
    const flare = angle
      .mul(3)
      .add(edge.mul(6))
      .sin()
      .mul(0.5)
      .add(0.5)
      .pow(6)
      .mul(edge.sub(0.12).div(0.32).pow(2).mul(-0.5).exp())
      .mul(resources.burst);
    const rim = mix(
      color(brand.blue),
      color(brand.purple),
      angle.mul(2).add(resources.phase.mul(9)).sin().mul(0.5).add(0.5)
    );
    const tunnel = angle
      .mul(72)
      .sub(distance.div(scale).mul(24))
      .add(resources.phase.mul(50))
      .sin()
      .mul(0.5)
      .add(0.5)
      .pow(12);
    return {
      color: mix(
        color('#18152f'),
        texture(
          resources.target.texture,
          screenUV
            .sub(mix(resources.center, vec2(0.5), smoothstep(0.18, 0.65, resources.radius)))
            .add(0.5)
        ).rgb,
        mask
      )
        .add(rim.mul(halo).mul(tunnel.mul(0.6).add(0.7)))
        .add(rim.mul(flare).mul(3))
        .add(color('#f2ffff').mul(core)),
      opacity: mask.add(surround).add(halo).add(core).add(flare).clamp().mul(opacity),
    };
  }, [resources, opacity]);

  useFrame(
    (state, delta) => {
      if (!mesh.current) return;
      const timeline = world.queryFirst(Timeline);
      const screen = timeline?.targetFor(ActiveScreen);
      const current = screen?.get(Screen);
      const fallingNow = !!current?.initiativePortalVisible;
      const insideNow = !!current?.initiativesVisible;
      if (!fallingNow && lens.current) {
        lens.current.camera.fov = lens.current.fov;
        lens.current.camera.updateProjectionMatrix();
        lens.current = null;
      }
      mesh.current.visible = fallingNow || insideNow || opacity.value > 0;
      if (!mesh.current.visible) return;
      const timing = timeline?.get(Timeline);
      const elapsed = world.get(Time)!.elapsed - (timing?.startedAt ?? 0);
      let dolly = 7;
      let snap = false;
      // TSL uniforms and the preview camera carry mutable render state outside React
      /* oxlint-disable react/immutability */
      if (fallingNow) {
        const motion = portalFallMotion(
          elapsed,
          timing!.duration,
          screen!.get(ScreenTransition)!.cameraDelay
        );
        const camera = state.camera as PerspectiveCamera;
        lens.current ??= { camera, fov: world.queryFirst(Camera)?.get(Camera)?.fov ?? camera.fov };
        camera.fov = lens.current.fov + motion.fov;
        camera.rotation.z += motion.bank;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        // The opening occupies PMNDRS's world position and grows as the camera returns
        const distance = camera.position.z;
        if (distance > 0) {
          resources.origin.set(0, 0, 0).project(camera);
          resources.center.value.set(0.5 + resources.origin.x * 0.5, 0.5 - resources.origin.y * 0.5);
        } else {
          resources.center.value.set(0.5, 0.5);
        }
        resources.radius.value =
          distance > 0
            ? (6.8 * motion.open * motion.radius) /
              (Math.max(0.1, distance) * 2 * Math.tan((camera.fov * Math.PI) / 360))
            : 3;
        resources.glow.value = motion.open * motion.energy;
        resources.burst.value = motion.burst;
        resources.spin.value = motion.spin;
        resources.phase.value = clamp(
          (elapsed - 0.8) / Math.max(0.001, timing!.duration - 0.8),
          0,
          1
        );
        dolly = 7 + Math.max(0, distance) * 0.6;
        snap = motion.open === 0;
      } else if (insideNow) {
        resources.center.value.set(0.5, 0.5);
        resources.radius.value = 3;
        resources.glow.value = 0;
        resources.burst.value = 0;
        resources.phase.value = 1;
      }
      // The preview camera trails its goal slightly, so the speed of the fall carries across
      // the crossing and the glade settles to rest instead of freezing when the screen changes
      const position = resources.camera.position;
      position.z = snap ? dolly : position.z + (dolly - position.z) * (1 - Math.exp(-delta / 0.14));
      /* oxlint-enable react/immutability */
      resources.camera.updateMatrixWorld();
      const target = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(resources.clearColor);
      try {
        renderer.setRenderTarget(resources.target);
        renderer.autoClear = true;
        renderer.render(resources.scene, resources.camera);
      } finally {
        renderer.setRenderTarget(target);
        renderer.setClearColor(resources.clearColor, alpha);
        renderer.autoClear = autoClear;
      }
    },
    { priority: -0.6 }
  );

  return (
    <mesh ref={mesh} name="initiative-portal" renderOrder={30} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        vertexNode={vec4(positionLocal.xy.mul(2), 0, 1)}
        colorNode={nodes.color}
        opacityNode={nodes.opacity}
        transparent
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
