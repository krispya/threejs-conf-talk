import { mulberry32 } from 'math/random';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import {
  attribute,
  color,
  hash,
  instanceIndex,
  mix,
  mx_noise_float,
  positionLocal,
  smoothstep,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
  type Node,
} from 'three/webgpu';

const GRASS_BLADES = 11000;

/** Grass bends above fixed terrain samples while wind and drifting light run on the GPU. */
export function createInitiativeGlade(model: Group, visibility: Node<'float'>) {
  const group = new Group();
  group.name = 'initiative-glade';
  const phase = uniform(0);
  const random = mulberry32.sample.bind(null, mulberry32.create(418));
  const blade = new BufferGeometry();
  blade.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -0.045, 0, 0, 0.045, 0, 0, -0.034, 0.4, 0.025, 0.034, 0.4, 0.025, -0.018, 0.75, 0.09, 0.018,
        0.75, 0.09, 0, 1, 0.19,
      ],
      3
    )
  );
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  blade.setAttribute(
    'uv',
    new Float32BufferAttribute([0, 0, 1, 0, 0, 0.4, 1, 0.4, 0, 0.75, 1, 0.75, 0.5, 1], 2)
  );
  blade.computeVertexNormals();
  const grassMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide,
    roughness: 1,
    metalness: 0,
  });
  const seed = hash(instanceIndex);
  const roots = new Float32Array(GRASS_BLADES * 4);
  blade.setAttribute('grassRoot', new InstancedBufferAttribute(roots, 4));
  const root = attribute<'vec4'>('grassRoot', 'vec4');
  const breeze = mx_noise_float(vec3(root.x.mul(1.4), root.z.mul(1.4), phase.mul(0.24)));
  const flutter = mx_noise_float(vec3(root.x.mul(4), root.z.mul(4), phase.mul(0.65)));
  // positionLocal already includes the instance transform, so anchor bending to blade UV height
  const bend = uv().y.mul(uv().y).mul(root.w);
  grassMaterial.positionNode = positionLocal.add(
    vec3(breeze.mul(0.22).add(flutter.mul(0.035)), 0, breeze.mul(0.09)).mul(bend)
  );
  grassMaterial.colorNode = mix(color('#102b2b'), color('#78966a'), uv().y);
  grassMaterial.emissiveNode = mix(color('#12382f'), color('#537d68'), uv().y)
    .mul(0.22)
    .mul(visibility);
  const grass = new InstancedMesh(blade, grassMaterial, GRASS_BLADES);
  grass.name = 'glade-grass';
  grass.count = 0;
  model.updateWorldMatrix(true, true);
  const position = new Vector3();
  const normal = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const matrix = new Matrix4();
  const tint = new Color();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const material = object.material as MeshStandardMaterial;
    if (material.name !== 'ground') return;
    const sampler = new MeshSurfaceSampler(object).build();
    // The upstream types omit the sampler's custom random generator
    Object.assign(sampler, { randomFunction: random });
    const normals = new Matrix3().getNormalMatrix(object.matrixWorld);
    for (let attempt = 0; attempt < GRASS_BLADES * 5 && grass.count < GRASS_BLADES; attempt++) {
      sampler.sample(position, normal);
      position.applyMatrix4(object.matrixWorld);
      normal.applyMatrix3(normals).normalize();
      if (normal.y < 0.55 || position.z < -1.2 || position.z > 3.8) continue;
      // Leave a winding approach and break the grass into irregular patches
      const path = Math.abs(position.x - 0.18 - Math.sin(position.z * 1.7) * 0.22);
      const patch =
        Math.sin(position.x * 4.1 + Math.sin(position.z * 3)) * Math.cos(position.z * 3.7);
      if (random() > (path < 0.48 ? 0.05 : 0.7 + patch * 0.28)) continue;
      const height = 0.12 + random() * 0.23;
      position.y -= 0.012;
      scale.set(height * (0.65 + random() * 0.6), height, height);
      rotation.setFromAxisAngle(up, random() * Math.PI * 2);
      matrix.compose(position, rotation, scale);
      roots.set([position.x, position.y, position.z, height], grass.count * 4);
      grass.setMatrixAt(grass.count, matrix);
      tint.setHSL(0.28 + random() * 0.14, 0.2, 0.65 + random() * 0.25);
      grass.setColorAt(grass.count++, tint);
    }
  });
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.computeBoundingSphere();
  if (grass.boundingSphere) grass.boundingSphere.radius += 0.12;
  group.add(grass);

  const geometry = new PlaneGeometry(1, 1, 1, 4);
  const anchors = new Float32Array(112 * 4);
  for (let i = 0; i < 112; i++) {
    anchors[i * 4] = (random() - 0.5) * 5.8;
    anchors[i * 4 + 1] = -1.65 + random() * 2.6;
    anchors[i * 4 + 2] = 0.3 + random() * 2.8;
    anchors[i * 4 + 3] = i < 88 ? 0.018 + random() * 0.025 : 0.18 + random() * 0.2;
  }
  geometry.setAttribute('gladeAnchor', new InstancedBufferAttribute(anchors, 4));
  const anchor = attribute<'vec4'>('gladeAnchor', 'vec4');
  const age = phase.mul(seed.mul(0.025).add(0.025)).add(seed).fract();
  const curl = phase.mul(0.3).add(seed.mul(40));
  const wisp = smoothstep(0.06, 0.15, anchor.w);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    side: DoubleSide,
  });
  material.positionNode = vec3(
    positionLocal.x
      .mul(anchor.w)
      .mul(mix(1, 0.6, wisp))
      .add(positionLocal.y.mul(5).add(curl).sin().mul(anchor.w).mul(wisp).mul(0.22)),
    positionLocal.y.mul(anchor.w).mul(mix(1, 2.4, wisp)),
    0
  )
    .add(anchor.xyz)
    .add(vec3(curl.sin().mul(0.24), age.mul(1.1), curl.mul(0.7).cos().mul(0.13)));
  const point = uv().sub(0.5).mul(2);
  const falloff = point
    .dot(point)
    .mul(-4)
    .exp()
    .mul(smoothstep(1, 0.5, point.length()));
  material.opacityNode = falloff
    .mul(smoothstep(0, 0.18, age))
    .mul(smoothstep(0.75, 1, age).oneMinus())
    .mul(mix(0.42, 0.035, wisp))
    .mul(visibility);
  material.colorNode = mix(color('#9de9db'), color('#c8acff'), seed).mul(1.4);
  const wisps = new InstancedMesh(geometry, material, 112);
  wisps.name = 'glade-wisps';
  wisps.frustumCulled = false;
  matrix.identity();
  for (let i = 0; i < wisps.count; i++) wisps.setMatrixAt(i, matrix);
  wisps.instanceMatrix.needsUpdate = true;
  group.add(wisps);
  return { group, phase, grass, wisps };
}

export function disposeInitiativeGlade(glade: ReturnType<typeof createInitiativeGlade>) {
  for (const mesh of [glade.grass, glade.wisps]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.dispose();
  }
}
