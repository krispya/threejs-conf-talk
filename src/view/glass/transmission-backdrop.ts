/* Screen-space backdrop capture for glass, after https://github.com/ektogamat/webgpu-glass-drei.
   Once per frame the scene is rendered without the glass meshes into a mipmapped target that the
   glass material then refracts. */
import { texture } from 'three/tsl';
import {
  BackSide,
  Color,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoToneMapping,
  NodeUpdateType,
  RenderTarget,
  Vector2,
} from 'three/webgpu';
import type { Camera, Material, Mesh, Object3D, Scene, Side, WebGPURenderer } from 'three/webgpu';
import type { GlassPhysicalNodeMaterial } from './glass-material-core.js';

/** userData flag: objects that sit on the glass and must not be captured into the backdrop. */
export const EXCLUDE_FROM_BACKDROP = 'excludeFromBackdrop';

export interface BackdropConfig {
  backside: boolean;
  backsideThickness: number;
  thickness: number;
  backdropResolutionScale: number;
  backsideResolutionScale: number;
  background: string | Color;
}

const TARGET_OPTIONS = {
  type: HalfFloatType,
  minFilter: LinearMipmapLinearFilter,
  magFilter: LinearFilter,
  generateMipmaps: true,
};

const scratchSize = new Vector2();

function scaledSize(renderer: WebGPURenderer, scale: number) {
  renderer.getDrawingBufferSize(scratchSize);
  return {
    width: Math.max(1, Math.round(scratchSize.x * scale)),
    height: Math.max(1, Math.round(scratchSize.y * scale)),
  };
}

function createTarget(width: number, height: number, name: string) {
  const target = new RenderTarget(width, height, TARGET_OPTIONS);
  target.texture.name = name;
  return target;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function usesMaterial(mesh: Mesh, materials: Set<Material>) {
  const material = mesh.material;
  return Array.isArray(material) ? material.some((m) => materials.has(m)) : materials.has(material);
}

export class TransmissionBackdropManager {
  readonly materials = new Set<GlassPhysicalNodeMaterial>();
  private readonly cleanTarget = createTarget(1, 1, 'TransmissionBackdropClean');
  private readonly backsideTarget = createTarget(1, 1, 'TransmissionBackdropBackside');
  readonly textureNode = texture(this.cleanTarget.texture);
  private lastCaptureTick = -1;

  // Targets are local JS descriptors until the first committed capture uses them
  constructor() {
    this.textureNode.updateBeforeType = NodeUpdateType.NONE;
  }

  register(material: GlassPhysicalNodeMaterial) {
    this.materials.add(material);
  }

  unregister(material: GlassPhysicalNodeMaterial) {
    this.materials.delete(material);
  }

  private resizeTargets(renderer: WebGPURenderer, config: BackdropConfig) {
    const clean = scaledSize(
      renderer,
      config.backside ? config.backsideResolutionScale : config.backdropResolutionScale
    );
    this.cleanTarget.setSize(clean.width, clean.height);

    if (config.backside) {
      const size = scaledSize(renderer, config.backdropResolutionScale);
      this.backsideTarget.setSize(size.width, size.height);
    }
  }

  dispose() {
    this.cleanTarget.dispose();
    this.backsideTarget.dispose();
    this.textureNode.value = this.cleanTarget.texture;
    this.materials.clear();
    this.lastCaptureTick = -1;
  }

  capture(renderer: WebGPURenderer, scene: Scene, camera: Camera, frameTick: number) {
    const first = this.materials.values().next().value;
    if (!first) return;
    if (frameTick === this.lastCaptureTick) return;
    const config = first.transmissionBackdropConfig;
    this.resizeTargets(renderer, config);

    const textureNode = this.textureNode;
    const cleanTarget = this.cleanTarget;

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevBackground = scene.background;
    const prevToneMapping = renderer.toneMapping;
    const prevExposure = renderer.toneMappingExposure;
    const prevTexture = textureNode.value;

    const materials = this.materials as unknown as Set<Material>;
    const hidden: Mesh[] = [];
    const excluded: Object3D[] = [];
    const restore: Array<{ material: GlassPhysicalNodeMaterial; thickness: number; side: Side }> = [];
    let captured = false;
    scene.traverseVisible((object) => {
      if (isMesh(object) && usesMaterial(object, materials)) {
        hidden.push(object);
        object.visible = false;
      } else if (object.userData[EXCLUDE_FROM_BACKDROP]) {
        excluded.push(object);
        object.visible = false;
      }
    });

    try {
      scene.background =
        config.background instanceof Color ? config.background : new Color(config.background);
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1;

      // Clean pass: everything except the glass
      renderer.setRenderTarget(cleanTarget);
      renderer.autoClear = true;
      renderer.render(scene, camera);

      for (const mesh of hidden) mesh.visible = true;

      if (config.backside) {
        // Backside pass: glass back faces refracting the clean capture
        textureNode.value = cleanTarget.texture;

        for (const material of this.materials) {
          restore.push({
            material,
            thickness: material.transmissionUniforms.thickness.value,
            side: material.side,
          });
          material.side = BackSide;
          material.transmissionUniforms.thickness.value = config.backsideThickness;
        }

        renderer.setRenderTarget(this.backsideTarget);
        renderer.autoClear = true;
        renderer.render(scene, camera);

        textureNode.value = this.backsideTarget.texture;
      } else {
        textureNode.value = cleanTarget.texture;
      }
      this.lastCaptureTick = frameTick;
      captured = true;
    } finally {
      for (const { material, thickness, side } of restore) {
        material.side = side;
        material.transmissionUniforms.thickness.value = thickness;
      }
      if (!captured) textureNode.value = prevTexture;
      for (const mesh of hidden) mesh.visible = true;
      for (const object of excluded) object.visible = true;
      scene.background = prevBackground;
      renderer.toneMapping = prevToneMapping;
      renderer.toneMappingExposure = prevExposure;
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAutoClear;
    }
  }
}
