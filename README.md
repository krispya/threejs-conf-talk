# threejs-conf-talk

The interactive slides for my Threejs Conf talk 2026 the pmndrs org.
Check out the talk here: https://x.com/pmndrs/status/2099452238569570549

This was an experiment in using our newest packages:

- React Three Fiber v10
- Koota
- Glyph
- Math

And a healthy amount of vibecoding using our frameworks to condition its output. It worked out well!

## Development

Use Node 26+ and pnpm 11+. Run `pnpm install`, then `pnpm dev`.

- `pnpm build` builds the site. `pnpm build:offline` packages a standalone HTML presentation on macOS.
- `pnpm test` runs the tests. `pnpm typecheck` checks types, with `--watch` for continuous checking.
- `pnpm lint -- <files>` lints selected files.
- `pnpm exec prettier --config .config/prettier.json --ignore-path .config/prettierignore --write <files>` formats selected files.

## Baking assets

Generated assets are checked in, so baking is only needed after changing their sources or recipes.
`pnpm bake` rebuilds the fonts and code images. Use `pnpm bake <target>` for a specific asset group,
or `pnpm bake --help` to list targets.

| Target                                                               | Sources and output                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `fonts`                                                              | The three TTFs in `public/fonts` become Glyph GLBs and Geist Black geometry outlines   |
| `code`                                                               | `src/package/comparison/data.ts` becomes the images in `public/code`                   |
| `discord-qr`                                                         | The invite and design in `scripts/bake.mjs` become `public/closing/discord-qr.png`     |
| `textures`                                                           | Rebuilds `nebula`, `environment`, and `emoji`, which can also be selected individually |
| `glyph`, `math`, `experimental`, `games`, `design-system`, `r3f-v10` | Video recipes in `scripts/bake-media.mjs` rebuild the corresponding initiative reels   |
| `sound`                                                              | Downloads the cabin recording if needed and rebuilds `public/sounds/cabin.mp3`         |
| `star-map`                                                           | `pnpm bake star-map /path/to/hygdata_v41.csv` rebuilds `public/sky/hyg-stars.png`      |

Texture bakes open a WebGPU browser and finish after saving the results. Add `--no-open` to open the
printed URL manually. Their rendering code lives in `scripts/bake-textures.ts`.

Video and sound bakes require `ffmpeg`. Games also use `yt-dlp` if a source clip is missing, and sound
uses `curl` if the recording is not cached. Set these environment variables to use different sources:

| Environment variable  | Default source                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GLYPH_MEDIA`         | `~/Downloads`, containing `glyph3.mov` and `glyph2.mov`. The demo is `public/initiatives/glyph.mp4`        |
| `MATH_RECORDING`      | `~/Downloads/mathzamples.mp4`                                                                              |
| `EXPERIMENTAL_MEDIA`  | `~/Downloads`, containing `klipp1.mp4` and `kilpp2.mp4`                                                    |
| `GAMES_MEDIA`         | `public/initiatives/games`                                                                                 |
| `DESIGN_SYSTEM_MEDIA` | `~/Downloads`, containing `design1.mp4`, `design2.mp4`, and `design3.mp4`                                  |
| `PROMO_MEDIA`         | `../minecraft-like/promo/media`, containing `track_promo.mp4`, `minecraft-like.mov`, and `faraz_watch.mov` |
| `R3F_V10_RECORDING`   | `~/Desktop/Screen Recording 2026-08-28 at 11.55.01 AM.mov`                                                 |

For example, `GLYPH_MEDIA=/path/to/recordings pnpm bake glyph` rebuilds the Glyph reel.
