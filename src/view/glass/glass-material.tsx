import { useFrame, useThree } from '@react-three/fiber/webgpu';
import { useEffect, useMemo } from 'react';
import { uniform } from 'three/tsl';
import { Color, FrontSide } from 'three/webgpu';
import type { Side } from 'three/webgpu';
import { GlassPhysicalNodeMaterial } from './glass-material-core.js';
import {
  captureBackdrop,
  getBackdropTextureNode,
  registerGlassMaterial,
  unregisterGlassMaterial,
} from './transmission-backdrop.js';
import { buildTransmissionBackdropNode, createTransmissionUniforms } from './transmission-nodes.js';

export interface GlassMaterialProps {
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
  const renderer = useThree((state) => state.renderer);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const material = useMemo(() => {
    const uniforms = createTransmissionUniforms({
      ior,
      thickness,
      backsideThickness,
      anisotropicBlur,
      distortion,
      distortionScale,
      temporalDistortion,
      attenuationDistance,
      attenuationColor: new Color(attenuationColor),
    });

    const next = new GlassPhysicalNodeMaterial({ name: 'GlassMaterial', transmission: 0 });
    next.transmissionUniforms = uniforms;
    next.transmissionNode = uniform(transmission);
    next.thicknessNode = uniforms.thickness;
    next.iorNode = uniforms.ior;
    next.attenuationDistanceNode = uniforms.attenuationDistance;
    next.attenuationColorNode = uniforms.attenuationColor;
    next.transmissionBackdropNode = buildTransmissionBackdropNode(
      getBackdropTextureNode(renderer),
      uniforms,
      samples
    );
    return next;
    // Only the sample count changes the compiled shader; everything else is a uniform.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, samples]);

  // Push prop changes into uniforms and material fields without recompiling.
  // Mutating the material is intentional: it is a Three object, not React state.
  // oxlint-disable-next-line react/immutability
  useEffect(() => {
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

  // oxlint-disable-next-line react/immutability
  useEffect(() => {
    registerGlassMaterial(material, scene, camera, renderer);
    return () => {
      unregisterGlassMaterial(material, renderer);
      material.dispose();
    };
  }, [material, scene, camera, renderer]);

  // Capture after the sim has synced transforms (priority 0) but before the render phase
  useFrame(
    // oxlint-disable-next-line react/immutability
    (state, delta) => {
      material.transmissionUniforms.time.value += delta;
      captureBackdrop(renderer, scene, camera, state.frame);
    },
    { priority: -1 }
  );

  return <primitive object={material} attach="material" />;
}
