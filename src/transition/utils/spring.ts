/** Spring arrival shared by package, title, and introduction animations. */
export function arrivalSpring(progress: number) {
  if (progress >= 1) return 1;
  return (
    1 - Math.exp(-10 * progress) * (Math.cos(12 * progress) + (10 / 12) * Math.sin(12 * progress))
  );
}
