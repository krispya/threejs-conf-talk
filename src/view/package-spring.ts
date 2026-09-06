/** Shared arrival curve for the packages and their backdrop. */
export function packageSpring(progress: number) {
  if (progress >= 1) return 1;
  return (
    1 - Math.exp(-10 * progress) * (Math.cos(12 * progress) + (10 / 12) * Math.sin(12 * progress))
  );
}
