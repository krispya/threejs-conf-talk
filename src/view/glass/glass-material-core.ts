import { uniform } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { Node, TextureNode } from 'three/webgpu';
import type { BackdropConfig } from './transmission-backdrop.js';
import { TransmissionPhysicalLightingModel } from './transmission-lighting-model.js';
import { buildTransmissionBackdropNode, createTransmissionUniforms } from './transmission-nodes.js';
import type { TransmissionUniforms } from './transmission-nodes.js';

/** MeshPhysicalNodeMaterial whose transmission samples a screen-space backdrop capture. */
export class GlassPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  transmissionBackdropNode: Node | null = null;
  transmissionUniforms!: TransmissionUniforms;
  transmissionBackdropConfig!: BackdropConfig;

  constructor(backdrop: TextureNode, samples: number) {
    super({ name: 'GlassMaterial', transmission: 0 });
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
