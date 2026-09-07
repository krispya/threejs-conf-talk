import { clamp } from 'math';

/** Shared chip dimensions keep labels readable and inside the package layout. */
export function packageLabelSize(radius: number, name: string) {
  const fontSize = clamp(radius * 0.24, 0.2, 0.26);
  return { fontSize, width: (name.length * 0.62 + 0.75) * fontSize };
}
