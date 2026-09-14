import { mulberry32 } from 'math/random';

export function createProfileLayout(capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('Invalid profile capacity');
  return {
    capacity,
    count: -1,
    aspect: NaN,
    inputs: new Float64Array(capacity * 3),
    points: new Float64Array(capacity * 2),
    seed: mulberry32.create(0),
  };
}

export type ProfileLayout = ReturnType<typeof createProfileLayout>;

/** Shared framing in viewport half-heights for the floating team and its robot teammate. */
export const teamLayout = {
  profiles: [
    [-1.15, 0.33],
    [0.72, 0.56],
    [-0.24, -0.61],
    [-0.5, 0.53],
    [1.16, -0.27],
    [0.08, 0.28],
    [-0.83, -0.32],
    [0.45, -0.25],
    [1.22, 0.3],
    [0.54, -0.68],
    [0.02, 0.76],
    [-1.16, -0.74],
    [-0.66, -0.75],
  ],
  robot: [-0.29, -0.08],
  radius: 0.155,
  // The robot follows the thirteen portraits at index 13.
  connections: [
    [0, 3],
    [0, 6],
    [3, 5],
    [3, 13],
    [6, 13],
    [6, 2],
    [13, 7],
    [6, 11],
    [11, 12],
    [12, 2],
    [6, 12],
    [3, 10],
    [10, 1],
    [10, 5],
    [5, 1],
    [5, 7],
    [1, 8],
    [8, 4],
    [7, 4],
    [7, 9],
    [2, 9],
    [4, 9],
  ],
} as const;
