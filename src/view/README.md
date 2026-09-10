# Rendering

The canvas owns every visual that can appear in glass. DOM elements are reserved for controls and the brand mark.

Entity renderers read visibility through `useEntityVisible`. It reads the current `Hidden` trait before initializing animation state and subscribes to later changes. Koota's `useHas` starts false before its subscription runs, so negating it directly can flash hidden objects on their first render.

Each frame follows the same order. Scheduler priorities run from higher to lower within the update phase:

1. `FrameLoop` advances the presentation clock and synchronizes scene transforms at priority `0`.
2. View animations update their objects and shader uniforms.
3. `useShowreel` composes the decoded video textures into one linear-color render target at `-0.8`.
4. `TransmissionBackdropProvider` captures the scene at `-1`, once for all active glass materials.
5. Fiber renders the scene to the canvas.

`Background` composes the pastel, space, portal, video, and blackout states into one opaque `scene.backgroundNode`. The same node is rendered into the glass capture. Video never needs a parallel DOM layer or a transparent hole in the canvas.

`showreel-motion.ts` owns deterministic transition state. It uses the presentation clock for the opening wall, focused tile, cut, blackout, and delayed return to pastel. Moving between screens with the same video focus preserves playback and framing. `showreel-source.ts` owns video elements, textures, cropping, and the offscreen composition. It creates media resources on mount, pauses covered clips, and releases decoders and GPU resources on cleanup.

Glass materials own optical properties and register while visible. The provider owns capture resolution and scheduling. Captures preserve the scene background and exclude glass and objects marked `EXCLUDE_FROM_BACKDROP` from the clean pass. An optional second pass captures glass back faces. Render targets, object visibility, and material settings are restored even if a pass fails.
