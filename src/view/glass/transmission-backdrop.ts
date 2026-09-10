import { texture } from 'three/tsl';
import {
  BackSide,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NodeUpdateType,
  RenderTarget,
  Vector2,
  type Camera,
  type Mesh,
  type Object3D,
  type Scene,
  type Side,
  type WebGPURenderer,
} from 'three/webgpu';
import type { GlassPhysicalNodeMaterial } from './glass-material-core.js';

/** Surface labels are drawn normally but excluded from the image inside the glass. */
export const EXCLUDE_FROM_BACKDROP = 'excludeFromBackdrop';

export interface BackdropConfig {
  backside: boolean;
  backsideThickness: number;
}

function createTarget(name: string) {
  const target = new RenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: true,
  });
  target.texture.name = name;
  return target;
}

/** One capture owner per canvas, independent of the number or ordering of glass materials. */
export function createTransmissionBackdrop() {
  const cleanTarget = createTarget('TransmissionBackdropClean');
  const textureNode = texture(cleanTarget.texture);
  textureNode.updateBeforeType = NodeUpdateType.NONE;
  return {
    cleanTarget,
    backsideTarget: createTarget('TransmissionBackdropBackside'),
    textureNode,
    materials: new Map<GlassPhysicalNodeMaterial, { side: Side; thickness: number }>(),
    hidden: [] as Mesh[],
    excluded: [] as Object3D[],
    size: new Vector2(),
    resolution: 0.85,
    backsideResolution: 0.7,
    lastCaptureTick: -1,
  };
}

export type TransmissionBackdrop = ReturnType<typeof createTransmissionBackdrop>;

export function registerTransmissionMaterial(
  backdrop: TransmissionBackdrop,
  material: GlassPhysicalNodeMaterial
) {
  backdrop.materials.set(material, {
    side: material.side,
    thickness: material.transmissionUniforms.thickness.value,
  });
}

export function disposeTransmissionBackdrop(backdrop: TransmissionBackdrop) {
  backdrop.cleanTarget.dispose();
  backdrop.backsideTarget.dispose();
  backdrop.materials.clear();
  backdrop.hidden.length = backdrop.excluded.length = 0;
  backdrop.lastCaptureTick = -1;
}

export function captureTransmissionBackdrop(
  backdrop: TransmissionBackdrop,
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  frameTick: number
) {
  if (!backdrop.materials.size || backdrop.lastCaptureTick === frameTick) return;
  const { materials, hidden, excluded, cleanTarget, backsideTarget, textureNode } = backdrop;
  hidden.length = excluded.length = 0;
  let backside = false;
  for (const [material, restore] of materials) {
    backside ||= material.transmissionBackdropConfig.backside;
    restore.side = material.side;
    restore.thickness = material.transmissionUniforms.thickness.value;
  }
  scene.traverseVisible((object) => {
    const mesh = object as Mesh;
    if (
      mesh.isMesh &&
      (Array.isArray(mesh.material)
        ? mesh.material.some((material) => materials.has(material as GlassPhysicalNodeMaterial))
        : materials.has(mesh.material as GlassPhysicalNodeMaterial))
    ) {
      hidden.push(mesh);
      mesh.visible = false;
    } else if (object.userData[EXCLUDE_FROM_BACKDROP]) {
      excluded.push(object);
      object.visible = false;
    }
  });
  if (!hidden.length) {
    for (const object of excluded) object.visible = true;
    return;
  }

  const previousTarget = renderer.getRenderTarget();
  const previousCubeFace = renderer.getActiveCubeFace();
  const previousMipmap = renderer.getActiveMipmapLevel();
  const previousAutoClear = renderer.autoClear;
  const previousTexture = textureNode.value;
  let captured = false;
  try {
    renderer.getDrawingBufferSize(backdrop.size);
    const cleanScale = backside ? backdrop.backsideResolution : backdrop.resolution;
    cleanTarget.setSize(
      Math.max(1, Math.round(backdrop.size.x * cleanScale)),
      Math.max(1, Math.round(backdrop.size.y * cleanScale))
    );
    if (backside)
      backsideTarget.setSize(
        Math.max(1, Math.round(backdrop.size.x * backdrop.resolution)),
        Math.max(1, Math.round(backdrop.size.y * backdrop.resolution))
      );
    // The scene owns its background, including video and every transition blend.
    renderer.setRenderTarget(cleanTarget);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (backside) {
      textureNode.value = cleanTarget.texture;
      for (const material of materials.keys()) {
        if (material.transmissionBackdropConfig.backside) {
          material.side = BackSide;
          material.transmissionUniforms.thickness.value =
            material.transmissionBackdropConfig.backsideThickness;
        }
      }
      for (const mesh of hidden) {
        const material = mesh.material;
        mesh.visible = Array.isArray(material)
          ? material.some(
              (entry) =>
                materials.has(entry as GlassPhysicalNodeMaterial) &&
                (entry as GlassPhysicalNodeMaterial).transmissionBackdropConfig.backside
            )
          : materials.has(material as GlassPhysicalNodeMaterial) &&
            (material as GlassPhysicalNodeMaterial).transmissionBackdropConfig.backside;
      }
      renderer.setRenderTarget(backsideTarget);
      renderer.render(scene, camera);
    }
    textureNode.value = backside ? backsideTarget.texture : cleanTarget.texture;
    backdrop.lastCaptureTick = frameTick;
    captured = true;
  } finally {
    if (backside) {
      for (const [material, restore] of materials) {
        material.side = restore.side;
        material.transmissionUniforms.thickness.value = restore.thickness;
      }
    }
    if (!captured) textureNode.value = previousTexture;
    for (const mesh of hidden) mesh.visible = true;
    for (const object of excluded) object.visible = true;
    renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmap);
    renderer.autoClear = previousAutoClear;
  }
}
