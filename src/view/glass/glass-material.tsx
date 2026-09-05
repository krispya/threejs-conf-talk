import { extend, useFrame } from '@react-three/fiber/webgpu';
import { useLayoutEffect, useRef } from 'react';
import { FrontSide } from 'three/webgpu';
import type { Side } from 'three/webgpu';
import { GlassPhysicalNodeMaterial } from './glass-material-core.js';
import { useTransmissionBackdrop } from './transmission-backdrop-provider.js';

const GlassMaterialElement = extend(GlassPhysicalNodeMaterial);

export interface GlassMaterialProps {
  /** Pause backdrop capture while retaining the material and its resources. */
  enabled?: boolean;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  transmission?: number;
  thickness?: number;
  roughness?: number;
  ior?: number;
  dispersion?: number;
  anisotropicBlur?: number;
  distortion?: number;
  distortionScale?: number;
  temporalDistortion?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
  envMapIntensity?: number;
  /** Refraction sample count (1–16). Changing it rebuilds the material. */
  samples?: number;
  backside?: boolean;
  backsideThickness?: number;
  backdropResolutionScale?: number;
  backsideResolutionScale?: number;
  /** Fill color while capturing the backdrop. */
  background?: string;
  side?: Side;
}

/**
 * Glass material for the WebGPU renderer, after drei's MeshTransmissionMaterial.
 * Captures the scene behind the glass once per frame and refracts it through the volume.
 */
export function GlassMaterial({
  enabled = true,
  color = '#ffffff',
  emissive = '#000000',
  emissiveIntensity = 0,
  transmission = 1,
  thickness = 0.35,
  roughness = 0.1,
  ior = 1.5,
  dispersion = 5,
  anisotropicBlur = 0.1,
  distortion = 0,
  distortionScale = 0.5,
  temporalDistortion = 0,
  attenuationColor = '#ffffff',
  attenuationDistance = 0,
  envMapIntensity = 0.5,
  samples = 6,
  backside = true,
  backsideThickness = 0.35,
  backdropResolutionScale = 0.85,
  backsideResolutionScale = 0.7,
  background = '#161616',
  side = FrontSide,
}: GlassMaterialProps) {
  const backdrop = useTransmissionBackdrop();
  const materialRef = useRef<GlassPhysicalNodeMaterial>(null);

  // Apply uniforms before the next capture or render
  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.transmissionUniforms;
    (material.transmissionNode as unknown as { value: number }).value = transmission;
    u.ior.value = ior;
    u.thickness.value = thickness;
    u.backsideThickness.value = backsideThickness;
    u.anisotropicBlur.value = anisotropicBlur;
    u.distortion.value = distortion;
    u.distortionScale.value = distortionScale;
    u.temporalDistortion.value = temporalDistortion;
    u.attenuationDistance.value = attenuationDistance;
    u.attenuationColor.value.set(attenuationColor);

    material.color.set(color);
    material.emissive.set(emissive);
    material.emissiveIntensity = emissiveIntensity;
    material.ior = ior;
    material.thickness = thickness;
    material.dispersion = dispersion;
    material.roughness = roughness;
    material.attenuationDistance = attenuationDistance;
    material.attenuationColor.set(attenuationColor);
    material.envMapIntensity = envMapIntensity;
    material.side = side;
    material.transmissionBackdropConfig = {
      backside,
      backsideThickness,
      thickness,
      backdropResolutionScale,
      backsideResolutionScale,
      background,
    };
  });

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!enabled || !material) return;
    backdrop.register(material);
    return () => backdrop.unregister(material);
  }, [backdrop, enabled, samples]);

  // Capture after the sim has synced transforms (priority 0) but before the render phase
  useFrame(
    (state, delta) => {
      const material = materialRef.current;
      if (!material) return;
      material.transmissionUniforms.time.value += delta;
      backdrop.capture(state.renderer, state.scene, state.camera, state.frame);
    },
    { priority: -1, enabled }
  );

  return (
    <GlassMaterialElement
      ref={materialRef}
      args={[backdrop.textureNode, samples]}
      attach="material"
    />
  );
}
