/* Screen-space backdrop capture for glass, after https://github.com/ektogamat/webgpu-glass-drei.
   Once per frame the scene is rendered without the glass meshes into a mipmapped target that the
   glass material then refracts. */
import { texture } from 'three/tsl';
import {
  BackSide,
  Color,
  FrontSide,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoToneMapping,
  NodeUpdateType,
  RenderTarget,
  Vector2,
} from 'three/webgpu';
import type {
  Camera,
  Material,
  Mesh,
  Object3D,
  Scene,
  TextureNode,
  WebGPURenderer,
} from 'three/webgpu';
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

class TransmissionBackdropManager {
  readonly materials = new Set<GlassPhysicalNodeMaterial>();
  scene: Scene | null = null;
  camera: Camera | null = null;
  private cleanTarget: RenderTarget | null = null;
  private backsideTarget: RenderTarget | null = null;
  private textureNode: TextureNode | null = null;
  private lastCaptureTick = -1;
  private readonly renderer: WebGPURenderer;

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
  }

  register(material: GlassPhysicalNodeMaterial, scene: Scene, camera: Camera) {
    this.materials.add(material);
    this.scene = scene;
    this.camera = camera;
    this.ensureResources();
  }

  unregister(material: GlassPhysicalNodeMaterial) {
    this.materials.delete(material);
  }

  private config(): BackdropConfig {
    const first = this.materials.values().next().value;
    return (
      first?.transmissionBackdropConfig ?? {
        backside: false,
        backsideThickness: 0,
        thickness: 0,
        backdropResolutionScale: 1,
        backsideResolutionScale: 1,
        background: '#000000',
      }
    );
  }

  private cleanSize(config: BackdropConfig) {
    return scaledSize(
      this.renderer,
      config.backside ? config.backsideResolutionScale : config.backdropResolutionScale
    );
  }

  private ensureResources() {
    const config = this.config();

    if (!this.cleanTarget) {
      const { width, height } = this.cleanSize(config);
      this.cleanTarget = createTarget(width, height, 'TransmissionBackdropClean');
    }

    if (config.backside && !this.backsideTarget) {
      const { width, height } = scaledSize(this.renderer, config.backdropResolutionScale);
      this.backsideTarget = createTarget(width, height, 'TransmissionBackdropBackside');
    }

    if (!this.textureNode) {
      this.textureNode = texture((this.backsideTarget ?? this.cleanTarget).texture);
      this.textureNode.updateBeforeType = NodeUpdateType.NONE;
    }
  }

  private resizeTargets(config: BackdropConfig) {
    const clean = this.cleanSize(config);
    if (
      this.cleanTarget &&
      (this.cleanTarget.width !== clean.width || this.cleanTarget.height !== clean.height)
    ) {
      this.cleanTarget.setSize(clean.width, clean.height);
    }

    if (config.backside) {
      const size = scaledSize(this.renderer, config.backdropResolutionScale);
      if (!this.backsideTarget) {
        this.backsideTarget = createTarget(size.width, size.height, 'TransmissionBackdropBackside');
      } else if (
        this.backsideTarget.width !== size.width ||
        this.backsideTarget.height !== size.height
      ) {
        this.backsideTarget.setSize(size.width, size.height);
      }
    } else if (this.backsideTarget) {
      this.backsideTarget.dispose();
      this.backsideTarget = null;
    }
  }

  getTextureNode() {
    this.ensureResources();
    return this.textureNode!;
  }

  capture(frameTick: number) {
    if (this.materials.size === 0 || !this.scene || !this.camera) return;
    if (frameTick === this.lastCaptureTick) return;
    this.lastCaptureTick = frameTick;

    this.ensureResources();
    const config = this.config();
    this.resizeTargets(config);

    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    const textureNode = this.textureNode!;
    const cleanTarget = this.cleanTarget!;

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevBackground = scene.background;
    const prevToneMapping = renderer.toneMapping;
    const prevExposure = renderer.toneMappingExposure;

    const materials = this.materials as unknown as Set<Material>;
    const hidden: Mesh[] = [];
    const excluded: Object3D[] = [];
    scene.traverse((object) => {
      if (!object.visible) return;
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

      if (config.backside && this.backsideTarget) {
        // Backside pass: glass back faces refracting the clean capture
        textureNode.value = cleanTarget.texture;

        const restore: Array<{ material: GlassPhysicalNodeMaterial; thickness: number }> = [];
        for (const material of this.materials) {
          restore.push({ material, thickness: material.transmissionUniforms.thickness.value });
          material.side = BackSide;
          material.transmissionUniforms.thickness.value = config.backsideThickness;
        }

        renderer.setRenderTarget(this.backsideTarget);
        renderer.autoClear = true;
        renderer.render(scene, camera);

        for (const { material, thickness } of restore) {
          material.side = FrontSide;
          material.transmissionUniforms.thickness.value = thickness;
        }

        textureNode.value = this.backsideTarget.texture;
      } else {
        textureNode.value = cleanTarget.texture;
      }
    } finally {
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

const managers = new WeakMap<WebGPURenderer, TransmissionBackdropManager>();

function getManager(renderer: WebGPURenderer) {
  let manager = managers.get(renderer);
  if (!manager) {
    manager = new TransmissionBackdropManager(renderer);
    managers.set(renderer, manager);
  }
  return manager;
}

export function registerGlassMaterial(
  material: GlassPhysicalNodeMaterial,
  scene: Scene,
  camera: Camera,
  renderer: WebGPURenderer
) {
  getManager(renderer).register(material, scene, camera);
}

export function unregisterGlassMaterial(
  material: GlassPhysicalNodeMaterial,
  renderer: WebGPURenderer
) {
  managers.get(renderer)?.unregister(material);
}

export function captureBackdrop(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  frameTick: number
) {
  const manager = managers.get(renderer);
  if (!manager) return;
  manager.scene = scene;
  manager.camera = camera;
  manager.capture(frameTick);
}

export function getBackdropTextureNode(renderer: WebGPURenderer) {
  return getManager(renderer).getTextureNode();
}
