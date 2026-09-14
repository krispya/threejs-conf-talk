import { clamp } from 'math';

/** Compress the download range logarithmically for the opening screen. */
export function compressedRadiusForDownloads(downloads: number, min: number, max: number) {
  if (max <= min) return 1.4;
  const share = Math.log10(downloads / min) / Math.log10(max / min);
  return 0.32 + clamp(share, 0, 1) * (1.4 - 0.32);
}

/** Scale bubble area with downloads while keeping the smallest packages visible. */
export function radiusForDownloads(downloads: number, max: number) {
  return Math.max(0.32, 2.8 * Math.sqrt(clamp(downloads / Math.max(1, max), 0, 1)));
}

/** Shared chip dimensions keep labels readable and inside the package layout. */
export function packageLabelSize(radius: number, name: string) {
  const fontSize = clamp(radius * 0.24, 0.2, 0.26);
  return { fontSize, width: (name.length * 0.62 + 0.75) * fontSize };
}
