import { Text, TextGroup } from '@pmndrs/glyph/react';
import { useMSDF } from '@pmndrs/glyph/react/msdf';
import { createPortal, useFrame, useLoader, useTexture, useThree } from '@react-three/fiber/webgpu';
import { useQueryFirst, useTarget, useTrait, useWorld } from 'koota/react';
import { clamp } from 'math';
import { type ComponentRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  atan,
  color,
  lights,
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
  Color,
  DirectionalLight,
  Fog,
  Group,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PointLight,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { ActiveScreen, Camera, Screen, ScreenTransition, Time, Timeline } from '../../sim/index.js';
import { initiatives } from '../../data/initiatives.js';
import { profiles } from '../../data/profiles.js';
import { portalArrivalLighting, portalConjureMotion } from '../../sim/portal-conjure.js';
import { portalFallMotion } from '../../sim/portal-fall.js';
import { brand, fonts, ramp } from '../../theme.js';
import { withMeshopt } from '../load-gltf.js';
import { initiativeSky } from '../initiative-sky.js';
import { useTransitionOpacity } from '../use-transition-opacity.js';
import { warmUp } from '../warm-up.js';
import { createInitiativeMedia } from './initiative-media.js';
import { InitiativeFeatureChip } from './initiative-feature-chip.js';
import { createInitiativeGlade, disposeInitiativeGlade } from './initiative-glade.js';

useLoader.preload(GLTFLoader, './meshes/magic_portal/scene.glb', withMeshopt);

/** A warp into a glade where an ancient stone portal will preview each initiative. */
export function InitiativeRenderer() {
  // Baked by scripts/bake-portal.mjs with the opening centered at the origin, facing +z,
  // one unit in radius, so the preview camera pushes straight in along z
  const gltf = useLoader(GLTFLoader, './meshes/magic_portal/scene.glb', withMeshopt);
  const stars = useLoader(TextureLoader, './sky/hyg-stars.png');
  const world = useWorld();
  const timeline = useQueryFirst(Timeline);
  const screen = useTarget(timeline, ActiveScreen);
  const data = useTrait(screen, Screen);
  const falling = !!data?.initiativePortalVisible;
  const inside = !!data?.initiativesVisible;
  const opacity = useTransitionOpacity(falling || inside, { duration: 0.3 });
  // The fall names the initiative it lands on, so its footage is decoding before the conjure
  const initiative = initiatives.find((entry) => entry.id === data?.initiative);
  const profile = profiles.find((profile) => profile.login === initiative?.profile);
  const portrait = useTexture(profile?.avatar ?? profiles[0].avatar, (texture) => {
    texture.colorSpace = SRGBColorSpace;
  });
  const font = useMSDF(fonts.mono);
  const label = useRef<Group>(null);
  const chipColumn = useRef<Group>(null);
  const profileRef = useRef<Group>(null);
  const labelText = useRef<ComponentRef<typeof Text>>(null);
  const installText = useRef<ComponentRef<typeof Text>>(null);
  const labelOpacity = useTransitionOpacity(inside, {
    duration: inside ? 0.7 : 0.3,
    delay: inside ? 0.4 : 0,
    clock: 'frames',
    restartKey: initiative?.id,
  });
  const labelWidth = (initiative?.title.length ?? 0) * 0.32 * 0.62 + 0.24;
  const installCommand =
    initiative && 'installCommand' in initiative ? initiative.installCommand : '';
  const installWidth = installCommand.length * 0.22 * 0.62 + 0.24;
  const chips = data?.initiativeChips.length
    ? data.initiativeChips
    : initiative && 'chips' in initiative
      ? initiative.chips
      : [];
  const chipsWidth = Math.max(0, ...chips.map((chip) => chip.length * 0.24 * 0.62 + 0.44));
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const mesh = useRef<Mesh>(null);
  const lens = useRef<{ camera: PerspectiveCamera; fov: number } | null>(null);
  const arrival = useRef({ inside: false, startedAt: 0 });
  const [resources] = useState(() => {
    // The opening lights the inner edges while neutral fill keeps the stone faces dark
    const scene = new Scene();
    scene.background = new Color('#28252d');
    scene.fog = new Fog('#28252d', 4.5, 14);
    const lamp = new PointLight('#d38aff', 22, 6, 2);
    lamp.position.set(0.1, -0.3, -0.25);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.05;
    lamp.shadow.camera.far = 6;
    lamp.shadow.bias = -0.0001;
    lamp.shadow.normalBias = 0.004;
    lamp.shadow.radius = 1.5;
    const moon = new DirectionalLight('#c5c6cd', 1.05);
    moon.position.set(-3, 5, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    // Fit the shadow camera to the ring and the grassy approach
    Object.assign(moon.shadow.camera, {
      left: -5,
      right: 5,
      top: 4,
      bottom: -4,
      near: 0.1,
      far: 20,
    });
    moon.shadow.camera.updateProjectionMatrix();
    moon.shadow.bias = -0.0001;
    moon.shadow.normalBias = 0.004;
    moon.shadow.radius = 2;
    const sky = new HemisphereLight('#a9a6b5', '#4a4039', 0.65);
    const auroraFill = new DirectionalLight('#88e5ee', 3.8);
    auroraFill.position.set(-4, 2, 5);
    const portalFill = new DirectionalLight('#c9a1ff', 2.6);
    portalFill.position.set(3, -0.5, 4);
    scene.add(sky, lamp, moon, auroraFill, portalFill);
    const camera = new PerspectiveCamera(45, 1, 0.1, 300);
    camera.position.z = 4.4;
    return {
      scene,
      camera,
      lamp,
      moon,
      sky,
      auroraFill,
      portalFill,
      lighting: lights([sky, lamp, moon]),
      foregroundLighting: lights([sky, lamp, moon, auroraFill, portalFill]),
      target: new RenderTarget(1, 1, { type: HalfFloatType, samples: 4 }),
      center: uniform(new Vector2(0.5, 0.5)),
      radius: uniform(0),
      glow: uniform(1),
      skyReveal: uniform(0),
      environmentReveal: uniform(0),
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
  useEffect(
    () => () => {
      resources.target.dispose();
      resources.lamp.shadow.dispose();
      resources.moon.shadow.dispose();
    },
    [resources]
  );
  const mediaRef = useRef<ReturnType<typeof createInitiativeMedia> | null>(null);
  // Media resources live on commit so their video frame callbacks survive remounts
  useEffect(() => {
    const media = createInitiativeMedia();
    mediaRef.current = media;
    resources.scene.add(media.mesh);
    return () => {
      resources.scene.remove(media.mesh);
      media.dispose();
      mediaRef.current = null;
    };
  }, [renderer, resources]);
  useEffect(() => {
    if (initiative?.video) mediaRef.current?.load(initiative.video, initiative.color);
  }, [initiative, renderer, resources]);
  useEffect(
    () => () => {
      if (lens.current) {
        lens.current.camera.fov = lens.current.fov;
        lens.current.camera.updateProjectionMatrix();
      }
    },
    []
  );
  const portal = useMemo(() => {
    const group = new Group();
    group.name = 'stone-portal';
    const model = gltf.scene.clone(true);
    // Preserve the source texture palette with restrained normals and dry surfaces
    model.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const original = mesh.material as MeshStandardMaterial;
      const ground = original.name === 'ground' || original.name === 'podium';
      const material = new MeshStandardNodeMaterial({
        name: original.name,
        map: original.map,
        color: original.color,
        roughness: ground ? 1 : 0.92,
        metalness: 0,
        normalMap: original.normalMap,
        side: original.side,
      });
      material.normalScale.copy(original.normalScale).multiplyScalar(ground ? 0.12 : 0.75);
      // Side fills catch the vegetation without washing out the portal's dark stone faces
      material.lightsNode = ['material', 'plant1', 'plant2'].includes(original.name)
        ? resources.foregroundLighting
        : resources.lighting;
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    group.add(model);
    return group;
  }, [gltf, resources]);
  const glade = useMemo(() => {
    const glade = createInitiativeGlade(portal, resources.environmentReveal);
    glade.grass.material.lightsNode = resources.foregroundLighting;
    glade.grass.castShadow = true;
    glade.grass.receiveShadow = true;
    return glade;
  }, [portal, resources]);
  const sky = useMemo(
    () =>
      initiativeSky(stars, glade.phase).mul(
        vec4(resources.skyReveal, resources.skyReveal, resources.skyReveal, 1)
      ),
    [stars, glade, resources]
  );
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/immutability
    resources.scene.backgroundNode = sky;
    resources.scene.add(portal, glade.group);
    return () => {
      resources.scene.remove(portal, glade.group);
    };
  }, [resources, portal, glade, sky]);
  useEffect(() => () => disposeInitiativeGlade(glade), [glade]);
  useEffect(
    () => () => {
      portal.traverse((object) => {
        if (object instanceof Mesh) (object.material as MeshStandardMaterial).dispose();
      });
    },
    [portal]
  );
  // Build both pipelines during the title screen so the fall never stalls on a first draw
  useEffect(() => {
    void warmUp(renderer, resources.scene, resources.camera, undefined, resources.target);
    if (mesh.current) void warmUp(renderer, mesh.current, camera, scene);
  }, [renderer, camera, scene, resources, portal, glade]);
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
      const media = mediaRef.current;
      if (!mesh.current || !media) return;
      const timeline = world.queryFirst(Timeline);
      const screen = timeline?.targetFor(ActiveScreen);
      const current = screen?.get(Screen);
      const fallingNow = !!current?.initiativePortalVisible;
      const insideNow = !!current?.initiativesVisible;
      const timing = timeline?.get(Timeline);
      if (insideNow && !arrival.current.inside) {
        arrival.current.startedAt = timing?.startedAt ?? world.get(Time)!.elapsed;
      }
      arrival.current.inside = insideNow;
      if (!fallingNow && lens.current) {
        lens.current.camera.fov = lens.current.fov;
        lens.current.camera.updateProjectionMatrix();
        lens.current = null;
      }
      mesh.current.visible = fallingNow || insideNow || opacity.value > 0;
      const elapsed = world.get(Time)!.elapsed - (timing?.startedAt ?? 0);
      const arrivalElapsed = world.get(Time)!.elapsed - arrival.current.startedAt;
      const conjure = insideNow ? portalConjureMotion(arrivalElapsed) : null;
      // Keep the opening shot paused until the footage starts to appear
      media.setPlaying(conjure !== null && conjure.reveal > 0);
      if (media.updateChannel(delta)) {
        void warmUp(renderer, media.mesh, resources.camera, resources.scene, resources.target);
      }
      if (!mesh.current.visible) return;
      // The preview camera rests just outside the ring so the stones frame the opening
      let dolly = 4.4;
      let snap = false;
      // TSL uniforms and the preview camera carry mutable render state outside React
      /* oxlint-disable react/immutability */
      glade.phase.value = world.get(Time)!.elapsed;
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
        dolly = 4.4 + Math.max(0, distance) * 0.22;
        snap = motion.open === 0;
      } else if (insideNow) {
        resources.center.value.set(0.5, 0.5);
        resources.radius.value = 3;
        resources.glow.value = 0;
        resources.burst.value = 0;
        resources.phase.value = 1;
      }
      // The footage is conjured once the glade is reached and drawn back in when it is left
      const settle = Math.exp(-delta / 0.12);
      media.open.value = conjure ? conjure.open : media.open.value * settle;
      media.reveal.value = conjure ? conjure.reveal : media.reveal.value * settle;
      media.energy.value = conjure ? conjure.energy : 1;
      media.phase.value = world.get(Time)!.elapsed;
      media.mesh.visible =
        !fallingNow && (conjure !== null || media.open.value > 0.001) && media.video.readyState >= 2;
      if (fallingNow || insideNow) {
        const light = portalArrivalLighting(
          insideNow ? arrivalElapsed : elapsed,
          fallingNow,
          timing!.duration,
          screen!.get(ScreenTransition)!.cameraDelay
        );
        resources.lamp.intensity = 22 * (0.75 + media.energy.value * 0.25) * light.portal;
        resources.moon.intensity = 1.05 * light.environment;
        resources.sky.intensity = 0.65 * light.environment;
        resources.auroraFill.intensity = 3.8 * light.environment;
        resources.portalFill.intensity = 2.6 * light.environment;
        resources.skyReveal.value = light.sky;
        resources.environmentReveal.value = light.environment;
        (resources.scene.fog as Fog).color.set('#28252d').multiplyScalar(light.sky);
      }
      // The preview camera trails its goal slightly, so the speed of the fall carries across
      // the crossing and the glade settles to rest instead of freezing when the screen changes
      const position = resources.camera.position;
      position.z = snap ? dolly : position.z + (dolly - position.z) * (1 - Math.exp(-delta / 0.14));
      // Keep the fog behind the stone ring as the preview camera approaches from far away
      (resources.scene.fog as Fog).near = position.z + 0.1;
      (resources.scene.fog as Fog).far = position.z + 9.6;
      /* oxlint-enable react/immutability */
      resources.camera.updateMatrixWorld();
      if (profileRef.current) {
        profileRef.current.position.y = Math.sin(glade.phase.value * 1.3) * 0.1 * labelOpacity.value;
        profileRef.current.rotation.z =
          Math.sin(glade.phase.value * 0.8) * 0.035 * labelOpacity.value;
      }
      if (label.current && labelText.current) {
        label.current.visible = labelOpacity.value > 0;
        label.current.position.set(0, 0, resources.camera.position.z - 1);
        const viewport = state.viewport.getCurrentViewport(resources.camera, label.current.position);
        const scale = Math.min(
          viewport.height / 9,
          viewport.width /
            Math.max(labelWidth + (profile ? 1.9 : 1), installWidth + 1.9, chipsWidth + 1.9)
        );
        label.current.scale.setScalar(scale * (0.8 + 0.2 * labelOpacity.value));
        label.current.position.x = profile ? 0.45 * scale : 0;
        label.current.position.y =
          viewport.height / 2 - (0.7 + 0.65 * (1 - labelOpacity.value)) * scale;
        if (chipColumn.current) {
          // Project the portal opening onto the label plane so the column stays centered
          media.mesh.getWorldPosition(chipColumn.current.position).project(resources.camera);
          chipColumn.current.position.z = resources.origin
            .copy(label.current.position)
            .project(resources.camera).z;
          chipColumn.current.position.unproject(resources.camera);
          label.current.updateWorldMatrix(true, false);
          label.current.worldToLocal(chipColumn.current.position);
        }
        if (labelText.current.style.opacity !== labelOpacity.value) {
          labelText.current.set({
            style: { ...labelText.current.style, opacity: labelOpacity.value },
          });
        }
        if (installText.current && installText.current.style.opacity !== labelOpacity.value) {
          installText.current.set({
            style: { ...installText.current.style, opacity: labelOpacity.value },
          });
        }
      }
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
    <>
      <mesh
        ref={mesh}
        name="initiative-portal"
        renderOrder={30}
        frustumCulled={false}
        visible={false}
      >
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
      {createPortal(
        <group ref={label} name="initiative-label" visible={false}>
          <group
            ref={profileRef}
            name={`initiative-${profile?.login ?? 'profile'}`}
            position={[-labelWidth / 2 - 0.48, 0, 0]}
            visible={!!profile}
          >
            <mesh renderOrder={10}>
              <ringGeometry args={[0.34, 0.365, 64]} />
              <meshBasicNodeMaterial
                color={ramp['light-25']}
                opacityNode={labelOpacity}
                transparent
                depthWrite={false}
                depthTest={false}
                toneMapped={false}
              />
            </mesh>
            <mesh renderOrder={11}>
              <circleGeometry args={[0.34, 64]} />
              <meshBasicNodeMaterial
                map={portrait}
                opacityNode={labelOpacity}
                transparent
                depthWrite={false}
                depthTest={false}
                toneMapped={false}
              />
            </mesh>
          </group>
          <mesh renderOrder={10}>
            <planeGeometry args={[labelWidth, 0.48]} />
            <meshBasicNodeMaterial
              color="#000000"
              opacityNode={labelOpacity}
              transparent
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          <TextGroup renderOrder={11}>
            <Text
              ref={labelText}
              font={font}
              position={[-labelWidth / 2, 0.16, 0.01]}
              constraints={{ width: { mode: 'exact', size: labelWidth } }}
              layout={{ align: 'center', wrap: 'none' }}
              style={{ fontSize: 0.32, lineHeight: 1, color: '#ffffff', opacity: 0 }}
            >
              {initiative?.title ?? ''}
            </Text>
          </TextGroup>
          {installCommand && (
            <group position={[0, -0.62, 0]}>
              <mesh renderOrder={10}>
                <planeGeometry args={[installWidth, 0.36]} />
                <meshBasicNodeMaterial
                  color="#000000"
                  opacityNode={labelOpacity}
                  transparent
                  depthWrite={false}
                  depthTest={false}
                  toneMapped={false}
                />
              </mesh>
              <TextGroup renderOrder={11}>
                <Text
                  ref={installText}
                  font={font}
                  position={[-installWidth / 2, 0.11, 0.01]}
                  constraints={{ width: { mode: 'exact', size: installWidth } }}
                  layout={{ align: 'center', wrap: 'none' }}
                  style={{ fontSize: 0.22, lineHeight: 1, color: '#ffffff', opacity: 0 }}
                >
                  {installCommand}
                </Text>
              </TextGroup>
            </group>
          )}
          <group ref={chipColumn}>
            {chips.map((chip, index) => (
              <InitiativeFeatureChip
                key={`${data?.id}:${chip}`}
                index={index}
                width={chipsWidth}
                count={chips.length}
                opacity={labelOpacity}
              >
                {chip}
              </InitiativeFeatureChip>
            ))}
          </group>
        </group>,
        resources.scene
      )}
    </>
  );
}
