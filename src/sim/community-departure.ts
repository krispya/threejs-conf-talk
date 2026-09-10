/** Let the download count settle before the portraits start to leave. */
export function communityDepartureTime(elapsed: number) {
  return Math.max(0, elapsed - 4);
}
