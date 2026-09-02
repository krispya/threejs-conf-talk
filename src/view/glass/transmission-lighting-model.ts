import { diffuseColor, mix, transmission } from 'three/tsl';
import { PhysicalLightingModel } from 'three/webgpu';
import type { Node, NodeBuilder } from 'three/webgpu';

/**
 * Physical lighting model that swaps Three's built-in IBL volume refraction for a backdrop
 * node sampled from a screen-space capture of the scene behind the glass.
 */
export class TransmissionPhysicalLightingModel extends PhysicalLightingModel {
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
