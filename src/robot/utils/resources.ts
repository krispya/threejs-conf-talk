import {
  color,
  lights,
  mix,
  normalView,
  texture,
  atan,
  positionLocal,
  smoothstep,
  uv,
} from 'three/tsl';
import {
  Box3,
  Euler,
  Group,
  Matrix4,
  MeshStandardNodeMaterial,
  PointLight,
  SpotLight,
  type Mesh,
  type MeshStandardMaterial,
  type Node,
} from 'three/webgpu';
import { brand } from '../../theme.js';

export function createRobotModel(
  source: Group,
  opacity: Node<'float'>,
  friendly: Node<'float'>,
  metalness: Node<'float'>,
  roughness: Node<'float'>
) {
  const scene = source.clone(true);
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
    const original = (
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    ) as MeshStandardMaterial;
    const surface = original.map ? texture(original.map).rgb : color('#e8e3d6');
    const material = new MeshStandardNodeMaterial({
      color: '#485361',
      metalness: 0.7,
      roughness: 0.32,
      transparent: true,
      toneMapped: false,
    });
    material.opacityNode = opacity;
    material.metalnessNode = metalness;
    material.roughnessNode = roughness;
    material.colorNode = mix(color('#485361'), surface, friendly);
    // The teammate keeps its texture colors with only a soft hint of shape at the edges
    material.emissiveNode = surface.mul(normalView.z.clamp(0, 1).mul(0.15).add(0.85)).mul(friendly);
    material.lightsNode = illumination;
    material.envNode = color('#05070f').mul(friendly.oneMinus());
    mesh.material = material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = -12;
    materials.push(material);
  });
  const bounds = new Box3()
    .setFromObject(scene)
    .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(0.16, -0.05, -0.015)));
  return {
    scene,
    materials,
    bounds,
    lighting,
    uplight,
    rim,
    fill,
  };
}

/**
 * Two arms winding out of the pupil, the classic hypnotist's spiral. Held clear of the eye
 * itself and thinning as it turns away, so it reads as something the robot is projecting.
 */
function hypnoticSpiral(strength: Node<'float'>, spin: Node<'float'>, spread: Node<'float'>) {
  const point = uv().sub(0.5).mul(2);
  const radius = point.length();
  const wave = atan(point.y, point.x).mul(2).sub(radius.mul(13)).add(spin).sin().mul(0.5).add(0.5);
  // The threshold widens toward the tail so the spiral fades gradually
  const half = smoothstep(0.22, 0.8, radius).mul(0.28).add(0.04);
  const bands = smoothstep(half.negate().add(0.84), half.add(0.84), wave);
  // The arms unwind out of the pupil: their outer edge starts inside the eye and travels out
  const front = spread.mul(0.86).add(0.06);
  const reach = smoothstep(0.12, 0.3, radius)
    .mul(smoothstep(front, front.sub(0.62), radius))
    .mul(radius.mul(-1.3).exp());
  return bands.mul(reach).mul(strength).mul(1.5);
}

export function createRobotEyeNodes(
  community: boolean,
  fault: Node<'float'>,
  eyes: Node<'float'>,
  flare: Node<'float'>,
  laser: Node<'float'>,
  swirl: Node<'float'>,
  spin: Node<'float'>,
  spread: Node<'float'>
) {
  const radial = uv().sub(0.5).mul(2).length();
  return {
    halo: radial
      .pow(2)
      .mul(-7)
      .exp()
      .mul(smoothstep(1, 0.65, radial))
      .mul(fault)
      .mul(0.72),
    pupilColor: color(community ? '#ff2014' : '#ffd8c5').mul(1.5),
    pupilPosition: positionLocal.mul(fault.mul(0.5).add(1)),
    pupilOpacity: eyes.mul(smoothstep(1, 0.78, radial)),
    glow: radial
      .mul(mix(-9, -5, fault))
      .exp()
      .mul(smoothstep(1, 0.65, radial))
      .mul(eyes)
      .mul(fault.mul(1.8).add(2.2)),
    spiral: hypnoticSpiral(swirl, spin, spread),
    flare: uv()
      .sub(0.5)
      .mul(2)
      .abs()
      .oneMinus()
      .clamp()
      .pow(2)
      .x.mul(uv().y.sub(0.5).abs().mul(-18).exp())
      .mul(flare),
    beam: uv().y.sub(0.5).mul(2).pow(2).mul(-5).exp().mul(laser).mul(0.8),
    beamCore: uv().y.sub(0.5).abs().mul(2).oneMinus().mul(laser),
  };
}
