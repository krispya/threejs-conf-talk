import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { MeshPhysicalNodeMaterialParameters, Node } from 'three/webgpu';
import type { BackdropConfig } from './transmission-backdrop.js';
import { TransmissionPhysicalLightingModel } from './transmission-lighting-model.js';
import type { TransmissionUniforms } from './transmission-nodes.js';

/** MeshPhysicalNodeMaterial whose transmission samples a screen-space backdrop capture. */
export class GlassPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  transmissionBackdropNode: Node | null = null;
  transmissionUniforms!: TransmissionUniforms;
  transmissionBackdropConfig!: BackdropConfig;

  constructor(parameters?: MeshPhysicalNodeMaterialParameters) {
    super(parameters);
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
