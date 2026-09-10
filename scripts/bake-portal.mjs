import { execFileSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { Matrix4, Quaternion, Vector3 } from 'three';

// Trim the Sketchfab export down to the empty stone ring, center the opening at the origin
// facing +z with an inner radius of one unit, then let glTF Transform shrink what remains.
const source = new URL('../reference/magic_portal/', import.meta.url);
const gltf = JSON.parse(await readFile(new URL('scene.gltf', source), 'utf8'));
const bin = await readFile(new URL('scene.bin', source));

function read(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? 12;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, i) => {
    const base = offset + i * stride;
    return new Vector3(bin.readFloatLE(base), bin.readFloatLE(base + 4), bin.readFloatLE(base + 8));
  });
}

const materialName = (node) => gltf.materials[gltf.meshes[node.mesh].primitives[0].material].name;
const parent = gltf.nodes.find((node) => node.children?.some((child) => gltf.nodes[child].mesh));
const attributes = (name) =>
  gltf.meshes[
    gltf.nodes[parent.children.find((child) => materialName(gltf.nodes[child]) === name)].mesh
  ].primitives[0].attributes;
const sum = (vectors) => vectors.reduce((total, v) => total.add(v), new Vector3());

// The baked disc faces the far side and its centroid seeds a fit of the ring stones
// near the opening plane. Their spread gives the ring's true center, axis, and inner radius.
const front = sum(read(attributes('magic').NORMAL)).normalize();
const disc = read(attributes('magic').POSITION);
const center = sum(disc).divideScalar(disc.length);
const stones = read(attributes('portal_stones2').POSITION);
const axis = front.clone();
let radius = 1;
for (let pass = 0; pass < 8; pass++) {
  const near = stones.filter((p) => {
    const offset = p.clone().sub(center);
    const along = offset.dot(axis);
    return Math.abs(along) < 1.2 && offset.addScaledVector(axis, -along).length() < 2.4;
  });
  center.copy(sum(near).divideScalar(near.length));
  // The direction of least spread through the near stones is the ring's axis, found by
  // inverse power iteration on their covariance
  const covariance = new Matrix4().makeScale(0, 0, 0);
  const e = covariance.elements;
  for (const p of near) {
    const d = p.clone().sub(center);
    e[0] += d.x * d.x;
    e[1] += d.y * d.x;
    e[2] += d.z * d.x;
    e[4] += d.x * d.y;
    e[5] += d.y * d.y;
    e[6] += d.z * d.y;
    e[8] += d.x * d.z;
    e[9] += d.y * d.z;
    e[10] += d.z * d.z;
  }
  const inverse = covariance.invert();
  for (let step = 0; step < 64; step++) axis.applyMatrix4(inverse).normalize();
  // The twig covered side, opposite the baked disc, faces the camera
  if (axis.dot(front) > 0) axis.negate();
  const radii = near
    .map((p) => {
      const offset = p.clone().sub(center);
      return offset.addScaledVector(axis, -offset.dot(axis)).length();
    })
    .sort((a, b) => a - b);
  radius = radii[Math.floor(radii.length * 0.05)];
}
console.log('ring center', center.toArray(), 'axis', axis.toArray(), 'inner radius', radius);

const root = new Matrix4().fromArray(gltf.nodes[0].matrix);
center.applyMatrix4(root);
axis.transformDirection(root);
gltf.nodes[0].matrix = new Matrix4()
  .makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(axis, new Vector3(0, 0, 1)))
  .multiply(new Matrix4().makeScale(1 / radius, 1 / radius, 1 / radius))
  .multiply(new Matrix4().makeTranslation(center.clone().negate()))
  .multiply(root)
  .toArray();

// Drop the baked portal and the inner stone circle so the opening is clear for previews
parent.children = parent.children.filter(
  (child) => !['magic', 'portal_stones1'].includes(materialName(gltf.nodes[child]))
);

const trimmed = new URL('scene.trimmed.gltf', source);
await writeFile(trimmed, JSON.stringify(gltf));
try {
  execFileSync(
    'pnpm',
    [
      'dlx',
      '@gltf-transform/cli@4.5.0',
      'optimize',
      trimmed.pathname,
      new URL('../public/meshes/magic_portal/scene.glb', import.meta.url).pathname,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
      '--simplify-ratio',
      '0.5',
      '--simplify-error',
      '0.001',
    ],
    { stdio: 'inherit' }
  );
} finally {
  await rm(trimmed);
}
