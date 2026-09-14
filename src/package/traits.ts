import { trait } from 'koota';

export const Package = trait({ name: '', label: '', downloads: 0, index: 0 });
export const PackageSizing = trait({ compressed: 1, proportional: 1 });

export const SizeTransition = trait({ from: 1, to: 1 });
