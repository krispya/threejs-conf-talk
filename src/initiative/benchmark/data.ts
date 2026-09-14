/**
 * Spider IK rig, 60 steps per iteration, one build using pmndrs math and one using Three's
 * built-ins, both written by Fable 5.1. Average time in milliseconds and heap in bytes per
 * iteration, from mitata runs on an Apple Silicon laptop.
 */
export const spiderBenchmarks = [
  { spiders: 5, math: { time: 0.243, heap: 376 }, three: { time: 0.344, heap: 94_480 } },
  { spiders: 50, math: { time: 2.02, heap: 152 }, three: { time: 3.13, heap: 752_440 } },
  { spiders: 500, math: { time: 19.13, heap: 200 }, three: { time: 30.59, heap: 7_790_000 } },
  { spiders: 5000, math: { time: 166, heap: 14_290 }, three: { time: 384.38, heap: 11_770_000 } },
] as const;

/**
 * Three bridge timings in microseconds from https://github.com/pmndrs/math/pull/50
 * Scene graph updates animate positions and quaternions, compose local matrices, and
 * propagate world matrices through a four-child hierarchy using extend(scene).
 */
export const threeBridgeBenchmarks = [
  { label: 'Instanced transforms', count: 10_000, three: 728, math: 318 },
  { label: 'Scene graph updates', count: 4096, three: 777, math: 331 },
  { label: 'Frustum culling', count: 4096, three: 293, math: 152 },
] as const;
