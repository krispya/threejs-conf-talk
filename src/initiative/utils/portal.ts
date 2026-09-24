import {
  atan,
  color,
  mix,
  positionLocal,
  screenSize,
  screenUV,
  smoothstep,
  texture,
  vec2,
  vec4,
  lights,
  uniform,
} from 'three/tsl';
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  type Node,
  Color,
  DirectionalLight,
  Fog,
  HalfFloatType,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  RenderTarget,
  Scene,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { brand } from '../../theme.js';

export function createInitiativePortal(source: Group, resources: InitiativeScene) {
  const group = new Group();
  group.name = 'stone-portal';
  const model = source.clone(true);
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
}

export function createInitiativePortalNodes(resources: InitiativeScene, opacity: Node<'float'>) {
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
    vertex: vec4(positionLocal.xy.mul(2), 0, 1),
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
}

export function createInitiativeScene() {
  // The opening lights the inner edges while neutral fill keeps the stone faces dark
  const scene = new Scene();
  scene.background = new Color('#28252d');
  scene.fog = new Fog('#28252d', 4.5, 14);
  const lamp = new PointLight('#d38aff', 22, 6, 2);
  lamp.position.set(0.1, -0.3, -0.25);
  lamp.castShadow = true;
  // Nothing that casts a shadow moves except the grass and leaf sway, so both maps render once
  lamp.shadow.autoUpdate = false;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.camera.near = 0.05;
  lamp.shadow.camera.far = 6;
  lamp.shadow.bias = -0.0001;
  lamp.shadow.normalBias = 0.004;
  lamp.shadow.radius = 1.5;
  const moon = new DirectionalLight('#c5c6cd', 1.05);
  moon.position.set(-3, 5, 6);
  moon.castShadow = true;
  moon.shadow.autoUpdate = false;
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
}

export type InitiativeScene = ReturnType<typeof createInitiativeScene>;

export function disposeInitiativeScene(resources: InitiativeScene) {
  resources.target.dispose();
  resources.lamp.shadow.dispose();
  resources.moon.shadow.dispose();
}

/** One while the initiative preview is opaque across the frame, so the sky behind it can be skipped. */
export const initiativeCover = uniform(0);
