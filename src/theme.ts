/**
 * Brand theme for the talk. Fonts are baked to GLB for @pmndrs/glyph with `pnpm bake`
 * (sources and OFL license live in public/fonts).
 */

export const fonts = {
  /** Geist Bold — https://fonts.google.com/specimen/Geist */
  sans: { baked: './fonts/geist.font.glb' },
  /** Geist Mono Medium — https://fonts.google.com/specimen/Geist+Mono */
  mono: { baked: './fonts/geist-mono.font.glb' },
} as const;

/** Brand colors (collection: brand) */
export const brand = {
  dark: '#36342f',
  light: '#eae5da',
  purple: '#d855f9',
  red: '#ff4980',
  orange: '#ffc043',
  yellow: '#ebff0f',
  green: '#caf543',
  teal: '#00f7a3',
  blue: '#2bdcf6',
} as const;

/** Ramp colors */
export const ramp = {
  'dark-900': '#191712',
  'light-25': '#fffdfa',
} as const;

/** Brand accents in spectrum order, handy for coloring a sequence like P M N D R S. */
export const spectrum = [
  brand.purple,
  brand.red,
  brand.orange,
  brand.yellow,
  brand.green,
  brand.teal,
  brand.blue,
] as const;

export const theme = {
  fonts,
  brand,
  ramp,
  spectrum,
  background: ramp['dark-900'],
  foreground: ramp['light-25'],
} as const;
