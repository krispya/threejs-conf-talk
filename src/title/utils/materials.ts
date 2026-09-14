import {
  attribute,
  cameraNear,
  cameraProjectionMatrix,
  Fn,
  If,
  mix,
  modelViewMatrix,
  mx_noise_float,
  positionGeometry,
  positionLocal,
  screenDPR,
  smoothstep,
  time,
  uv,
  varying,
  vec2,
  vec4,
  viewport,
} from 'three/tsl';

import type { Node } from 'three/webgpu';

export function createTitleWireNodes(
  speed: Node<'float'>,
  letterOpacity: Node<'float'>,
  outside: Node<'float'>
) {
  // Exponential depth growth starts at the letter faces and accelerates toward infinity
  const extension = speed.clamp().mul(Math.log(10001)).exp().sub(1).div(10000);
  const start = attribute<'vec3'>('instanceStart', 'vec3');
  const end = attribute<'vec3'>('instanceEnd', 'vec3');
  const depth = varying(mix(start.z, end.z, positionGeometry.y.clamp()).mul(extension));
  const vertex = Fn(() => {
    const a = modelViewMatrix.mul(vec4(start.xy, start.z.mul(extension), 1)).toVar();
    const b = modelViewMatrix.mul(vec4(end.xy, end.z.mul(extension), 1)).toVar();
    const near = cameraNear.negate();
    const hidden = a.z.greaterThan(near).and(b.z.greaterThan(near)).toVar();
    // Trim crossings before dividing by depth as the title passes the camera.
    If(a.z.greaterThan(near).and(b.z.lessThanEqual(near)), () => {
      a.assign(mix(a, b, near.sub(a.z).div(b.z.sub(a.z))));
    });
    If(b.z.greaterThan(near).and(a.z.lessThanEqual(near)), () => {
      b.assign(mix(b, a, near.sub(b.z).div(a.z.sub(b.z))));
    });
    const clipStart = cameraProjectionMatrix.mul(a);
    const clipEnd = cameraProjectionMatrix.mul(b);
    const direction = clipEnd.xy
      .div(clipEnd.w.max(cameraNear))
      .sub(clipStart.xy.div(clipStart.w.max(cameraNear)))
      .mul(viewport.zw);
    // Collapsed rails have no screen direction until the extrusion begins.
    const normal = vec2(direction.y, direction.x.negate()).div(direction.length().max(0.000001));
    const projected = mix(clipStart, clipEnd, positionGeometry.y.clamp());
    const offset = normal.mul(positionGeometry.x).mul(1.5).mul(screenDPR).div(viewport.zw);
    // Preserve perspective at arbitrary depths without clipping at the far plane.
    return hidden.select(
      vec4(0, 0, 0, -1),
      vec4(projected.xy.add(offset.mul(projected.w)), projected.w.mul(0.99999), projected.w)
    );
  })();
  return {
    vertex,
    opacity: depth
      .negate()
      .div(12)
      .add(1)
      .pow(-0.6)
      .mul(letterOpacity)
      .mul(speed.mul(8).clamp())
      .mul(outside)
      .mul(0.65),
    faceOpacity: letterOpacity.mul(outside),
  };
}

export function createTitleFragmentNodes(
  speed: Node<'float'>,
  letterOpacity: Node<'float'>,
  outside: Node<'float'>
) {
  const acceleration = smoothstep(0, 1, speed);
  const warp = smoothstep(1, 4, speed);
  const particle = attribute<'vec4'>('particle', 'vec4');
  // Each fragment has its own lifetime and tumbles away from a point on the contour.
  const age = time.mul(particle.y.mul(0.3).add(0.4)).add(particle.x).fract();
  const travel = age
    .pow(1.4)
    .mul(acceleration.mul(0.16).add(warp.mul(0.65)))
    .mul(particle.y.mul(0.7).add(0.65));
  const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
  const curl = age
    .pow(2)
    .mul(acceleration.mul(0.1).add(warp.mul(0.48)))
    .mul(particle.w.mul(0.8).add(0.4));
  const radial = clip.xy.mul(viewport.zw).mul(travel.add(1));
  const twisted = vec2(
    radial.x.mul(curl.cos()).sub(radial.y.mul(curl.sin())),
    radial.x.mul(curl.sin()).add(radial.y.mul(curl.cos()))
  ).div(viewport.zw);
  const spin = particle.w.mul(6.28).add(age.mul(particle.y.mul(8).sub(4)));
  const corner = uv()
    .mul(2)
    .sub(1)
    .mul(vec2(particle.y.mul(1.1).add(0.7), 1));
  const size = particle.z
    .pow(2)
    .mul(3.5)
    .add(1.25)
    .mul(smoothstep(0.55, 1, age).oneMinus())
    .mul(acceleration);
  const tumble = vec2(
    corner.x.mul(spin.cos()).sub(corner.y.mul(spin.sin())),
    corner.x.mul(spin.sin()).add(corner.y.mul(spin.cos()))
  );
  const outward = twisted.mul(viewport.zw);
  const direction = outward.div(outward.length().max(0.000001));
  const dash = direction
    .mul(corner.x)
    .mul(warp.mul(1.8).add(1.6))
    .add(vec2(direction.y.negate(), direction.x).mul(corner.y).mul(0.32));
  const offset = mix(tumble, dash, particle.w.greaterThan(0.75).select(1, 0))
    .mul(size)
    .mul(screenDPR)
    .mul(2)
    .div(viewport.zw)
    .mul(clip.w);
  const shape = uv().mul(2).sub(1);
  const chipped = shape
    .dot(shape)
    .add(mx_noise_float(shape.mul(4).add(varying(particle.w).mul(17))).mul(0.28));
  return {
    vertex: clip.w
      .greaterThan(cameraNear)
      .select(vec4(twisted.add(offset), clip.zw), vec4(0, 0, 0, -1)),
    opacity: smoothstep(0.68, 0.82, chipped)
      .oneMinus()
      .mul(smoothstep(0, 0.035, varying(age)))
      .mul(0.85)
      .mul(acceleration)
      .mul(letterOpacity)
      .mul(outside),
  };
}
