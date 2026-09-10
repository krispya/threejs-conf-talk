/**
 * The closing wall of community demos, read row by row. Each clip is cut from the
 * Poimandres showreel's grid section and loops on its own window, so the tiles drift
 * apart instead of falling into one beat. Cut windows live in public/showreel/README.md.
 */
export const showreelTiles = [
  { id: 'gems', title: 'Gems', video: './showreel/gems.mp4' },
  { id: 'pmndrs-letters', title: 'Poimandres letters', video: './showreel/pmndrs-letters.mp4' },
  { id: 'suzanne', title: 'Gold Suzanne', video: './showreel/suzanne.mp4' },
  { id: 'spline-scene', title: 'Spline scene', video: './showreel/spline-scene.mp4' },
  { id: 'circular-gallery', title: 'Circular gallery', video: './showreel/circular-gallery.mp4' },
  { id: 'portal', title: 'Portal cards', video: './showreel/portal.mp4' },
  { id: 'pomegranates', title: 'Pomegranates', video: './showreel/pomegranates.mp4' },
  { id: 'image-carousel', title: 'Image carousel', video: './showreel/image-carousel.mp4' },
  { id: 'torus-particles', title: 'Torus particles', video: './showreel/torus-particles.mp4' },
  { id: 'camera-scene', title: 'Camera scene', video: './showreel/camera-scene.mp4' },
  { id: 'inter-text', title: 'Inter text', video: './showreel/inter-text.mp4' },
  { id: 'painterly', title: 'Painterly still life', video: './showreel/painterly.mp4' },
  { id: 'r3f', title: 'React Three Fiber', video: './showreel/r3f.mp4' },
  { id: 'postprocessing', title: 'Postprocessing examples', video: './showreel/postprocessing.mp4' },
  { id: 'balls', title: 'Balls', video: './showreel/balls.mp4' },
  { id: 'reflective-sphere', title: 'Reflective sphere', video: './showreel/reflective-sphere.mp4' },
] as const;

/** The crow postprocessing demo plays once the wall has closed in on the black orb. */
export const showreelCutaway = './showreel/react-pp.mp4';

/** Columns in the wall. The tile list fills them row by row. */
export const showreelColumns = 4;

/**
 * Seconds for the shared scene background to dissolve into the video wall and back.
 */
export const showreelDissolve = 2.5;

/**
 * The tile that fills the frame before the pull back, by index into the wall. Its clip
 * is cut so the camera approaches three painting portals and enters one at 3.7 seconds,
 * which is where the pull back starts, so the wall opens out of the portal.
 */
export const showreelHero = 5;
