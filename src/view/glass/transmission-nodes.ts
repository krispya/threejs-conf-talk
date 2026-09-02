/* Volume refraction in TSL, after drei's MeshTransmissionMaterial and
   https://github.com/ektogamat/webgpu-glass-drei. */
import {
  DFGLUT,
  Fn,
  Loop,
  abs,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cross,
  dFdx,
  dFdy,
  diffuseColor,
  dispersion,
  div,
  exp,
  float,
  int,
  interleavedGradientNoise,
  length,
  log,
  log2,
  max,
  metalness,
  mix,
  modelWorldMatrix,
  normalWorld,
  normalize,
  positionWorld,
  pow,
  refract,
  roughness,
  screenCoordinate,
  screenSize,
  select,
  specularColor,
  specularF90,
  triNoise3D,
  vec2,
  vec3,
  vec4,
  vogelDiskSample,
} from 'three/tsl';
import { uniform } from 'three/tsl';
import type { Color, Node, TextureNode } from 'three/webgpu';

const MAX_TRANSMISSION_SAMPLES = 16;
const PI2 = 6.28318530718;

// TSL's Fn takes loosely typed node tuples; `any` keeps the port readable.
/* oxlint-disable typescript/no-explicit-any */
type N = any;
const fn: N = Fn;

export interface TransmissionParams {
  ior: number;
  thickness: number;
  backsideThickness: number;
  anisotropicBlur: number;
  distortion: number;
  distortionScale: number;
  temporalDistortion: number;
  attenuationDistance: number;
  attenuationColor: Color;
}

export function createTransmissionUniforms(params: TransmissionParams) {
  return {
    ior: uniform(params.ior),
    thickness: uniform(params.thickness),
    backsideThickness: uniform(params.backsideThickness),
    anisotropicBlur: uniform(params.anisotropicBlur),
    distortion: uniform(params.distortion),
    distortionScale: uniform(params.distortionScale),
    temporalDistortion: uniform(params.temporalDistortion),
    attenuationDistance: uniform(params.attenuationDistance),
    attenuationColor: uniform(params.attenuationColor),
    time: uniform(0),
  };
}

export type TransmissionUniforms = ReturnType<typeof createTransmissionUniforms>;

const getVolumeTransmissionRay = fn(([n, v, thicknessVal, iorVal, modelMatrix]: N[]) => {
  const refractionVector = vec3(refract(v.negate(), normalize(n), div(1.0, iorVal)) as N);
  const modelScale = vec3(
    length(modelMatrix[0].xyz),
    length(modelMatrix[1].xyz),
    length(modelMatrix[2].xyz)
  );
  return normalize(refractionVector).mul(thicknessVal.mul(modelScale));
}).setLayout({
  name: 'getVolumeTransmissionRay',
  type: 'vec3',
  inputs: [
    { name: 'n', type: 'vec3' },
    { name: 'v', type: 'vec3' },
    { name: 'thicknessVal', type: 'float' },
    { name: 'iorVal', type: 'float' },
    { name: 'modelMatrix', type: 'mat4' },
  ],
});

const applyIorToRoughness = fn(([roughnessVal, iorVal]: N[]) =>
  roughnessVal.mul(clamp(iorVal.mul(2.0).sub(2.0), 0.0, 1.0))
).setLayout({
  name: 'applyIorToRoughness',
  type: 'float',
  inputs: [
    { name: 'roughnessVal', type: 'float' },
    { name: 'iorVal', type: 'float' },
  ],
});

const volumeAttenuation = fn(([transmissionDistance, attColor, attDistance]: N[]) => {
  const attenuationCoefficient = log(attColor).negate().div(attDistance);
  const transmittance = exp(attenuationCoefficient.negate().mul(transmissionDistance));
  return select(attDistance.notEqual(0.0), transmittance, vec3(1.0));
}).setLayout({
  name: 'volumeAttenuation',
  type: 'vec3',
  inputs: [
    { name: 'transmissionDistance', type: 'float' },
    { name: 'attColor', type: 'vec3' },
    { name: 'attDistance', type: 'float' },
  ],
});

const refractionCoordsFor = fn(
  ([n, v, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix]: N[]) => {
    const transmissionRay = getVolumeTransmissionRay(n, v, thicknessVal, iorVal, modelMatrix);
    const refractedRayExit = position.add(transmissionRay);
    const ndcPos = projMatrix.mul(viewMatrix.mul(vec4(refractedRayExit, 1.0)));
    const coords = vec2(ndcPos.xy.div(ndcPos.w)).toVar();
    coords.addAssign(1.0);
    coords.divAssign(2.0);
    coords.assign(vec2(coords.x, coords.y.oneMinus()));
    return coords;
  }
);

function backdropFootprintLod(coords: N) {
  const coordsPx = coords.mul(screenSize);
  const footprint = max(length(dFdx(coordsPx)), length(dFdy(coordsPx)));
  return log2(max(footprint, 1.0));
}

function createGetTransmissionSample(backdropTextureNode: TextureNode) {
  return fn(([fragCoord, roughnessVal, iorVal, minLod]: N[]) => {
    const roughnessLod = applyIorToRoughness(roughnessVal, iorVal);
    const lod = max((log2(screenSize.x) as N).mul(roughnessLod), minLod);
    return (backdropTextureNode.sample(fragCoord) as N).level(lod);
  });
}

function createRefractSample(getTransmissionSample: N) {
  return fn(
    ([
      n,
      v,
      roughnessVal,
      iorVal,
      thicknessVal,
      position,
      modelMatrix,
      viewMatrix,
      projMatrix,
      minLod,
    ]: N[]) => {
      const coords = refractionCoordsFor(
        n,
        v,
        iorVal,
        thicknessVal,
        position,
        modelMatrix,
        viewMatrix,
        projMatrix
      );
      return getTransmissionSample(coords, roughnessVal, iorVal, minLod);
    }
  );
}

export function buildTransmissionBackdropNode(
  backdropTextureNode: TextureNode,
  uniforms: TransmissionUniforms,
  requestedSamples = 6
): Node {
  const samples = Math.min(MAX_TRANSMISSION_SAMPLES, Math.max(1, Math.round(requestedSamples)));
  const getTransmissionSample = createGetTransmissionSample(backdropTextureNode);
  const refractSample = createRefractSample(getTransmissionSample);

  const volumeRefraction = fn(() => {
    const n: N = normalWorld;
    const position: N = positionWorld;
    const v: N = cameraPosition.sub(positionWorld).normalize();
    const roughnessVal: N = roughness;
    const diffuse: N = diffuseColor;
    const specColor: N = mix(specularColor, diffuseColor.rgb, metalness);
    const specF90: N = specularF90;
    const modelMatrix: N = modelWorldMatrix;
    const viewMatrix: N = cameraViewMatrix;
    const projMatrix: N = cameraProjectionMatrix;
    const iorVal: N = uniforms.ior;
    const thicknessVal: N = uniforms.thickness;
    const attColor: N = uniforms.attenuationColor;
    const attDistance: N = uniforms.attenuationDistance;
    const sampleCount = float(samples);

    const transmissionAccum = vec3(0.0).toVar();
    const randomCoords = interleavedGradientNoise(screenCoordinate.xy);
    const phi = (interleavedGradientNoise(screenCoordinate.xy.add(vec2(17.0, 31.0))) as N).mul(PI2);

    const thicknessSmear = thicknessVal.mul(
      max(pow(roughnessVal, 0.33), uniforms.anisotropicBlur as N)
    );

    const edgeFactor = pow(float(1).sub(n.dot(v).clamp()), float(2.0));
    const edgeThicknessBoost = thicknessVal.mul(edgeFactor.mul(0.55));

    const distortionAmt: N = uniforms.distortion;
    const temporalOffset = vec3(
      uniforms.time,
      (uniforms.time as N).negate(),
      (uniforms.time as N).negate()
    ).mul(uniforms.temporalDistortion as N);
    const noisePos = position.mul(uniforms.distortionScale).add(temporalOffset);
    const distortionNormal = distortionAmt
      .mul(float(0.15).add(edgeFactor.mul(0.85)))
      .mul(
        vec3(
          triNoise3D(noisePos, float(0.2), uniforms.time as N),
          triNoise3D(noisePos.zxy, float(0.2), uniforms.time as N),
          triNoise3D(noisePos.yxz, float(0.2), uniforms.time as N)
        )
      );

    const halfSpread = iorVal.sub(1.0).mul((dispersion as N).mul(0.025));
    const iorR = iorVal.sub(halfSpread);
    const iorG = iorVal;
    const iorB = iorVal.add(halfSpread);

    const refractionLod = backdropFootprintLod(
      refractionCoordsFor(n, v, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix)
    );

    const basisUp = abs(n.z)
      .lessThan(0.999)
      .select(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0));
    const tangent = normalize(cross(basisUp, n));
    const bitangent = cross(n, tangent);
    const roughnessScale = roughnessVal.mul(roughnessVal).mul(2.0);

    Loop({ start: 0, end: samples, type: 'float', condition: '<' }, ({ i }: N) => {
      const disk = vogelDiskSample(int(i), int(samples), phi);
      const jitter = tangent.mul(disk.x).add(bitangent.mul(disk.y));
      const sampleNorm = normalize(n.add(roughnessScale.mul(jitter)).add(distortionNormal));

      const sampleOffset = i.add(randomCoords).div(sampleCount);
      const sampleThickness = thicknessVal
        .add(thicknessSmear.mul(sampleOffset))
        .add(edgeThicknessBoost);

      const sampleFor = (ior: N) =>
        refractSample(
          sampleNorm,
          v,
          roughnessVal,
          ior,
          sampleThickness,
          position,
          modelMatrix,
          viewMatrix,
          projMatrix,
          refractionLod
        );

      transmissionAccum.addAssign(vec3(sampleFor(iorR).r, sampleFor(iorG).g, sampleFor(iorB).b));
    });

    transmissionAccum.divAssign(sampleCount);

    const transmissionRay = getVolumeTransmissionRay(n, v, thicknessVal, iorVal, modelMatrix);
    const attenuatedColor = diffuse
      .mul(volumeAttenuation(length(transmissionRay), attColor, attDistance))
      .mul(transmissionAccum);

    const dotNV = n.dot(v).clamp();
    const fab: N = DFGLUT({ dotNV, roughness: roughnessVal });
    const F = specColor.mul(fab.x).add(specF90.mul(fab.y));

    const rgb = F.oneMinus().mul(attenuatedColor);
    return vec4(rgb.x, rgb.y, rgb.z, float(1.0));
  });

  return volumeRefraction();
}
/* oxlint-enable typescript/no-explicit-any */
