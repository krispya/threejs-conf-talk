# Showreel wall clips

Looping cuts of the closing grid from the Poimandres showreel (`../promotional-video`, `src/showreel/cuts.ts`). Windows below are that edit's `trimBefore`/`trimAfter` converted from 30 fps composition frames to seconds. Tiles are baked to 16:9 with cover framing at 800 × 450, slow tiles have their playback rate baked in, and `portal.mp4` keeps 1920 × 1080 because it fills the frame before the zoom out. Cuts from the examples proxy are cropped to 1836 × 1080 first, past the dark margins that recording carries down both sides. The `CleanShot` captures are screen recordings at roughly 4:3, so cover framing trims their top and bottom, and their 120 fps is decimated to the wall's 30.

| Clip                    | Source                              | Window            | Notes                                                                                   |
| ----------------------- | ----------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `gems.mp4`              | `CleanShot 5.51.26 PM.mp4`          | full              | screen capture, 120 fps                                                                 |
| `pmndrs-letters.mp4`    | `CleanShot 5.52.23 PM.mp4`          | full              | screen capture, 120 fps                                                                 |
| `suzanne.mp4`           | `CleanShot 5.53.38 PM.mp4`          | full              | screen capture, 120 fps                                                                 |
| `spline-scene.mp4`      | `~/Desktop/spline scene.mov`        | full              | 800 × 450, 30 fps, H.264, CRF 23, slow preset, no audio                                 |
| `circular-gallery.mp4`  | `pmndrs_examples_proxy.mp4`         | 170.000 – 178.067 |                                                                                         |
| `portal.mp4`            | `pmndrs_examples_proxy.mp4`         | 349.000 – 363.000 | hero, full resolution, approach into the portal at 3.7s                                 |
| `pomegranates.mp4`      | `CleanShot 5.55.37 PM.mp4`          | full              | screen capture, 120 fps                                                                 |
| `image-carousel.mp4`    | `pmndrs_examples_proxy.mp4`         | 263.000 – 273.000 |                                                                                         |
| `torus-particles.mp4`   | `pmndrs_examples_proxy.mp4`         | 124.000 – 141.000 |                                                                                         |
| `camera-scene.mp4`      | `pmndrs_examples_proxy.mp4`         | 149.333 – 159.000 |                                                                                         |
| `inter-text.mp4`        | `pmndrs_examples_proxy.mp4`         | 396.000 – 411.000 |                                                                                         |
| `painterly.mp4`         | `pmndrs_examples_proxy.mp4`         | 309.600 – 314.500 | half speed                                                                              |
| `glass-object.mp4`      | Desktop screen recording, see below | 26.500 – 30.100   | glass shapes, half speed, content-only crop                                             |
| `postprocessing.mp4`    | `pmndrs-pp-examples.mov`            | 22.500 – 28.900   |                                                                                         |
| `balls.mp4`             | `pmndrs_examples_proxy.mp4`         | 236.200 – 239.900 | half speed                                                                              |
| `reflective-sphere.mp4` | `pmndrs_examples_proxy.mp4`         | 215.100 – 219.500 | half speed                                                                              |
| `react-pp.mp4`          | `react-pp.mp4`                      | full              | crow demo after the orb zoom, 1080 × 1080, 30 fps, H.264, CRF 21, slow preset, no audio |

Grid order, the hero index, and the cutaway clip are configured in `src/data/showreel.ts`. The crow demo keeps its source resolution and uses centered cover framing during fullscreen playback.

`glass-object.mp4` uses `~/Desktop/Screen Recording 2026-08-06 at 10.22.19 AM.mov`, cropped to 1440 × 810 at (590, 430) to exclude the sidebar and navigation. The cut ends before the text selection and loops at half speed, encoded at 800 × 450, 30 fps, H.264, CRF 21, slow preset, without audio.
