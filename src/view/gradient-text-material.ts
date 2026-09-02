import { defineTextMaterial } from '@pmndrs/glyph/three';
import { float, luminance, mix, smoothstep, vec3 } from 'three/tsl';
import { gradientNode } from './background.js';

export interface GradientTextOptions {
  /** Fixed luminance gap between the text and whatever is behind it (linear light). */
  contrast: number;
  /** Saturation multiplier applied to the sampled field before the luminance shift. */
  saturation: number;
}

/** Below this luminance the backdrop is dark enough that text goes lighter instead of darker. */
const FLIP_LOW = 0.26;
const FLIP_HIGH = 0.38;

/**
 * Text cut from the same gradient as the backdrop and held a fixed luminance distance from it:
 * darker over the pale areas, lighter inside the dusky band. Legibility stays constant while
 * the color still belongs to the field behind it. The default glyph material keeps the MSDF
 * coverage in its opacity, so only the color node is replaced.
 */
export function createGradientTextMaterial({ contrast, saturation }: GradientTextOptions) {
  return defineTextMaterial((context) => {
    const material = context.createDefaultMaterial();
    const field = gradientNode();
    const lum = luminance(field);
    const saturated = mix(vec3(lum), field, saturation);

    const darker = saturated.mul(lum.sub(contrast).max(0.02).div(lum.max(0.001)));
    const lighter = mix(saturated, vec3(1), float(contrast).div(float(1).sub(lum).max(0.05)).clamp());
    const towardDark = smoothstep(FLIP_LOW, FLIP_HIGH, lum);

    material.colorNode = mix(lighter, darker, towardDark);
    return material;
  });
}
