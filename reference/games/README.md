# Games source footage

Public videos by Isaac Mason, downloaded from his X posts on 2026-09-11. These originals are inputs to `pnpm bake:games`. The playback copy is `public/initiatives/games.mp4`.

| File              | Source                                                | Content                                                          | Cut in seconds |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------- | -------------- |
| `boiler-room.mp4` | https://x.com/isaac_mason_/status/2075454607237820797 | Boiler-room crawlers with Crashcat physics and Navcat navigation | 0.5–6.5        |
| `crashcat.mp4`    | https://x.com/isaac_mason_/status/2021906714686280052 | Crashcat car driving through rigid bodies                        | 2–10           |
| `navcat.mp4`      | https://x.com/isaac_mason_/status/1988012661884555729 | Navcat crowd navigation                                          | 7–15           |
| `wizard.mp4`      | https://x.com/isaac_mason_/status/2027394705194119447 | Wizard in a splat world with physics and navigation              | 1–9            |

The Crashcat and Navcat posts are linked from [Isaac's portfolio](https://isaacmason.com/). Crops remove recording borders and browser controls, including the wizard demo's left sidebar. The videos are fitted inside the portal's center square and joined with straight cuts into a 30-second silent loop. The bake script can download missing originals with `yt-dlp`, or use a different source directory via `GAMES_MEDIA`.
