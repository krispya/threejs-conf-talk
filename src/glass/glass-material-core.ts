import { uniform, diffuseColor, mix, transmission } from 'three/tsl';
import {
  MeshPhysicalNodeMaterial,
  type Node,
  type TextureNode,
  PhysicalLightingModel,
  type NodeBuilder,
} from 'three/webgpu';
import type { BackdropConfig } from './transmission-backdrop.js';
import {
  buildTransmissionBackdropNode,
  createTransmissionUniforms,
  type TransmissionUniforms,
} from './transmission-nodes.js';

/** MeshPhysicalNodeMaterial whose transmission samples a screen-space backdrop capture. */
export class GlassPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  transmissionBackdropNode: Node | null = null;
  transmissionUniforms!: TransmissionUniforms;
  transmissionBackdropConfig!: BackdropConfig;

  constructor(backdrop: TextureNode, samples: number) {
    super({ name: 'GlassMaterial', transmission: 0, transparent: true, depthWrite: false });
    this.transmissionUniforms = createTransmissionUniforms({
      ior: this.ior,
      thickness: this.thickness,
      backsideThickness: this.thickness,
      anisotropicBlur: 0,
      distortion: 0,
      distortionScale: 0.5,
      temporalDistortion: 0,
      attenuationDistance: this.attenuationDistance,
      attenuationColor: this.attenuationColor.clone(),
    });
    this.transmissionNode = uniform(1);
    this.thicknessNode = this.transmissionUniforms.thickness;
    this.iorNode = this.transmissionUniforms.ior;
    this.attenuationDistanceNode = this.transmissionUniforms.attenuationDistance;
    this.attenuationColorNode = this.transmissionUniforms.attenuationColor;
    this.transmissionBackdropNode = buildTransmissionBackdropNode(
      backdrop,
      this.transmissionUniforms,
      samples
    );
  }

  override setupLightingModel() {
    return new TransmissionPhysicalLightingModel(
      this.useClearcoat,
      this.useSheen,
      this.useIridescence,
      this.useAnisotropy,
      this.transmissionBackdropNode
    );
  }
}

/**
 * Physical lighting model that swaps Three's built-in IBL volume refraction for a backdrop
 * node sampled from a screen-space capture of the scene behind the glass.
 */
class TransmissionPhysicalLightingModel extends PhysicalLightingModel {
  private readonly backdropNode: Node | null;

  constructor(
    clearcoat: boolean,
    sheen: boolean,
    iridescence: boolean,
    anisotropy: boolean,
    backdropNode: Node | null
  ) {
    super(clearcoat, sheen, iridescence, anisotropy, false, false);
    this.backdropNode = backdropNode;
  }

  override start(builder: NodeBuilder) {
    if (this.backdropNode !== null) {
      const context = builder.context as Record<string, unknown>;
      context.backdrop = this.backdropNode;
      context.backdropAlpha = transmission;
      diffuseColor.a.mulAssign(mix(1, (this.backdropNode as any).a, transmission));
    }

    super.start(builder);
  }
}
