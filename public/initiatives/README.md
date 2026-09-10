# Initiative clips

Local copies of Poimandres' public demo videos for the conference presentation.

| Asset               | Original post                                          | Video variant |
| ------------------- | ------------------------------------------------------ | ------------- |
| `glyph.mp4`         | https://x.com/pmndrs/status/2083554840752353742        | 720 × 720     |
| `glyph-reel.mp4`    | Original Glyph demo plus `glyph3.mov` and `glyph2.mov` | 1280 × 720    |
| `design-system.mp4` | `design1.mp4`, `design2.mp4`, and `design3.mp4`        | 1280 × 720    |
| `r3f-v10.mp4`       | Advanced R3F Workshop promo captures and R3F demos     | 1280 × 720    |
| `mathzamples.mp4`   | `~/Downloads/mathzamples.mp4`                          | 1280 × 720    |

Sources are configured in `src/data/initiatives.ts` and each screen names the initiative the stone portal shows. `r3f-v10.mp4` is a 36.6 second loop cut by `pnpm bake:r3f-v10` (`scripts/bake-r3f-v10.mjs`). It begins with the workshop promo captures in `../minecraft-like/promo/media`, following that Remotion edit's shot list: website hero, product configurator, then voxel game.

The final 20 seconds are a montage from `~/Desktop/Screen Recording 2026-08-28 at 11.55.01 AM.mov`, with loading pauses trimmed and the full capture height preserved. Set `R3F_V10_RECORDING` to use another path for this recording, or `PROMO_MEDIA` to relocate the workshop captures.

Glyph follows R3F v10 in the stone portal, with an animated chip and Justin Walsh's floating portrait. `pnpm bake:glyph` (`scripts/bake-glyph.mjs`) builds a 33.5-second montage in `glyph-reel.mp4`, intercutting the `glyph3.mov` wordmark, typography features from the original `glyph.mp4`, and interactive cube labels from `glyph2.mov`. The opener lasts 3 seconds, with subsequent shots lasting 2–4 seconds. The recordings default to `~/Downloads`, or set `GLYPH_MEDIA` to their directory. Each clip fits inside the portal's center square, and the original `glyph.mp4` remains the source for future rebuilds.

Design System follows Glyph with an animated chip and the floating `castavridis` portrait. `pnpm bake:design-system` (`scripts/bake-design-system.mjs`) intercuts liquid controls, floral UI, and animated glass panels from `design1.mp4`, `design2.mp4`, and `design3.mp4`. Eight 2.5-second shots make a 20-second loop. Sources default to `~/Downloads`, or set `DESIGN_SYSTEM_MEDIA` to their directory. Square captures fit inside the portal's center square.

Math follows Design System with an animated chip and Isaac Mason's floating portrait. `pnpm bake:math` (`scripts/bake-math.mjs`) uses the full 36.3-second `~/Downloads/mathzamples.mp4` recording. The 3456 × 2082 capture is cropped to 2732 × 1992 at (724, 90), removing the left sidebar and browser toolbar, then fitted inside the portal's center square. Set `MATH_RECORDING` to relocate the source recording.

Experimental follows Math with three floating yellow chips: FRS Upscaler, Denoiser, and Klipp. `pnpm bake:experimental` (`scripts/bake-experimental.mjs`) joins `klipp1.mp4` followed by `kilpp2.mp4` into a 58.1-second silent loop at `experimental.mp4`. Both full recordings fit inside the portal's center square in a 1280 × 720 video. Sources default to `~/Downloads`, or set `EXPERIMENTAL_MEDIA` to their directory.
