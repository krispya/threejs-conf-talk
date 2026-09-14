/** Independent local drift along a label's top or bottom edge, with portraits in front. */
export function placeMaintainerPortrait(
  out: Float32Array,
  width: number,
  height: number,
  radius: number,
  packageIndex: number,
  index: number,
  count: number,
  elapsed: number
) {
  if (!(width > 0 && height > 0 && radius > 0 && count > 0 && Number.isFinite(elapsed))) {
    out.fill(0);
    return out;
  }

  const phase = packageIndex * 2.4 + index * 1.7;
  const time = elapsed * (0.5 + ((packageIndex + index) % 3) * 0.08) + phase;
  const side = (packageIndex + index) % 2 === 0 ? 1 : -1;

  out[0] =
    (index - (count - 1) / 2) * radius * 2 +
    Math.sin(time * 0.7) * Math.min(width * 0.22, radius * 1.2);
  out[1] = side * (height * 0.5 + radius * 0.65) + Math.sin(time) * radius * 0.25;
  out[2] = 0.03 + Math.cos(time * 0.5) * 0.005;
  out[3] = radius;
  return out;
}
