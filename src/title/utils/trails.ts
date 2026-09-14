import { clamp } from 'math';

/** Fixed-capacity particle data and instance matrices, owned by the title view. */
export function createTitleTrails(capacity: number, sample: () => number = Math.random) {
  if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('Invalid trail capacity');
  const particles = new Float64Array(capacity * 6);
  const matrices = new Float32Array(capacity * 16);
  for (let i = 0; i < capacity; i++) {
    const angle = sample() * Math.PI * 2;
    const offset = i * 6;
    particles[offset] = Math.cos(angle);
    particles[offset + 1] = Math.sin(angle);
    particles[offset + 2] = sample();
    particles[offset + 3] = 0.022 + sample() * 0.01;
    particles[offset + 4] = 0.1 + sample() * 0.08;
    particles[offset + 5] = 2.2 + sample() * 1.8;
    matrices[i * 16 + 10] = 1;
    matrices[i * 16 + 15] = 1;
  }
  return {
    capacity,
    count: 0,
    particles,
    matrices,
    geometry: new Float64Array(capacity * 5),
    previous: new Float64Array([NaN, NaN, NaN]),
  };
}

export type TitleTrails = ReturnType<typeof createTitleTrails>;

/** O(n) with no allocations. Invalid framing or motion hides the instances until valid again. */
export function updateTitleTrails(
  out: TitleTrails,
  time: number,
  boost: number,
  width: number,
  height: number,
  pixelHeight: number,
  depth: number,
  portalRadius: number
): TitleTrails {
  out.count = 0;
  if (
    !(width > 0 && height > 0 && pixelHeight > 0) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(pixelHeight) ||
    !Number.isFinite(time) ||
    !Number.isFinite(boost) ||
    !Number.isFinite(depth) ||
    !Number.isFinite(portalRadius)
  )
    return out;

  const { particles, geometry, matrices, previous } = out;
  const resized = width !== previous[0] || height !== previous[1];
  const accelerated = boost !== previous[2];
  const coreDensity = clamp(boost, 0, 1);
  const outerDensity = clamp((boost - 1) / 3, 0, 1);
  const pixelSize = height / pixelHeight;
  for (let i = 0; i < out.capacity; i++) {
    const particle = i * 6;
    const shape = i * 5;
    if (resized) {
      const x = (particles[particle] * width) / 2;
      const y = (particles[particle + 1] * height) / 2;
      const length = Math.hypot(x, y);
      geometry[shape] = x;
      geometry[shape + 1] = y;
      geometry[shape + 2] = 1 / length;
      geometry[shape + 3] = height / (2 * length);
    }
    if (accelerated) {
      geometry[shape + 4] = Math.exp(-particles[particle + 4] * (1 + boost * 0.35) * 4.6);
    }
    const x = geometry[shape];
    const y = geometry[shape + 1];
    const travel = (particles[particle + 2] + time * particles[particle + 3]) % 1;
    const density =
      i < 96 ? coreDensity : i < 288 ? clamp(boost * 2 - (i - 96) / 192, 0, 1) : outerDensity;
    const source = portalRadius * geometry[shape + 3];
    const headOffset = 0.035 * Math.exp(travel * 4.6);
    const head = source + headOffset;
    const tail = source + headOffset * geometry[shape + 4];
    const thickness =
      pixelSize *
      particles[particle + 5] *
      (0.65 + head * 0.6) *
      clamp(travel / 0.12, 0, 1) *
      density;
    const offset = i * 16;
    // The radial basis directly supplies the scaled rotation columns.
    matrices[offset] = x * (head - tail);
    matrices[offset + 1] = y * (head - tail);
    matrices[offset + 4] = -y * geometry[shape + 2] * thickness;
    matrices[offset + 5] = x * geometry[shape + 2] * thickness;
    matrices[offset + 12] = (x * (head + tail)) / 2;
    matrices[offset + 13] = (y * (head + tail)) / 2;
    matrices[offset + 14] = depth;
  }
  previous[0] = width;
  previous[1] = height;
  previous[2] = boost;
  out.count = out.capacity;
  return out;
}
