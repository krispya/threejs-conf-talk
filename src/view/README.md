# Rendering

The canvas owns every visual that can appear in glass. DOM elements are reserved for controls and the brand mark.

Use `useMemo` for shader nodes, uniforms, scratch data, and other garbage-collectable render allocations. State represents reactive changes rather than retaining an allocation. Work that allocates GPU resources or starts media belongs in an effect with matching cleanup. Gate dependent components on readiness so discarded renders do no external work and Strict Mode effect replay creates fresh resources. `Background` loads the saved nebula through the cached EXR loader, with Suspense gating rendering until it is ready. Regenerate `public/sky/nebula.exr` with `pnpm bake:nebula`. The command opens a local WebGPU bake page, verifies a lossless half-float RGBA round trip, saves the texture, and shuts down. RGB stores emission and alpha stores dust transmission. The procedural bake runs only in the authoring script. `pnpm bake:environment` saves the filtered room lighting as `public/sky/environment.exr`, including the cube-UV orientation conversion needed for loaded maps. `pnpm bake:emoji` saves the three speech-bubble PNGs under `public/emoji/`. All commands share `scripts/bake-textures.mjs`, and the runtime components only load and bind those cached assets.

Entity renderers read visibility through `useEntityVisible` in `view/hooks.ts`. It reads the current `IsHidden` trait before initializing animation state and subscribes to later changes. Koota's `useHas` starts false before its subscription runs, so negating it directly can flash hidden objects on their first render.

Koota reaches the view through two paths:

| Change                                                 | Integration                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Position, rotation, animated size, focus, or time      | Read current world data in a system or scheduled frame callback and mutate captured objects or uniforms |
| Entity creation or removal                             | React queries update the mapped view graph                                                              |
| Active screen, visibility, content, or asset selection | React subscriptions configure the view and dispatch transition commands                                 |
| Geometry construction parameters                       | React builds or replaces geometry when the parameter changes                                            |
| Asset readiness or completed exit                      | Notify React once to change readiness or scheduling                                                     |

`useQuery` observes membership, so querying `Profile, Position, ProfileFocus, Size` does not subscribe React to each value's frame updates. Use `useTrait` for values that should trigger a React update. `Timeline` holds navigation timestamps and duration updated by actions, while `Time` advances every frame and is read imperatively.

`useViewBinding` captures the Three object in `Ref`. `syncTransforms` queries current position and rotation and writes directly to that object. Local visual systems scheduled with `useFrame` read current world data and mutate captured scales, materials, retained glyphs, and shader uniforms without rendering React. Capture objects and animation state, then read current Koota values during each update rather than retaining a render-time snapshot of animated data.

Package radius changes use `entity.get(Size)` inside the frame update to scale the existing sphere. Profiles currently subscribe to their fixed radius to construct portrait geometry, while animated focus scale is read from `ProfileFocus` during the frame. If portrait radius becomes animated, move that value to the imperative path as well.

`useTransitionOpacity` owns a shader uniform and the lifetime of its transition entity. Discrete visibility, screen, option, and readiness changes call `transition/actions.ts`. The action captures the current numeric value and timing for reversal or restart. `advanceTransitions` updates the world value before view callbacks run, and the hook copies that value into its uniform without subscribing React to it. Transition state contains no Three objects. An outgoing fade retains its captured timing until another command arrives, including when automatic navigation runs before React commits.

React state setters in the frame loop are reserved for discrete handoffs. Package and profile exit completion disables their scheduled updates, and letter preparation enables its reveal after layout and GPU submission finish. Opacity, progress, transforms, and download-count animation stay outside React state.

Each frame follows the same order. Scheduler priorities run from higher to lower within the update phase:

1. `FrameLoop` advances the presentation clock and synchronizes scene transforms at priority `0`.
2. View animations update their objects and shader uniforms.
3. `useShowreel` composes the decoded video textures into one linear-color render target at `-0.8`.
4. `TransmissionBackdropProvider` captures the scene at `-1`, once for all active glass materials.
5. Fiber renders the scene to the canvas.

`Background` composes the pastel, space, portal, video, and blackout states into one opaque `scene.backgroundNode`. The same node is rendered into the glass capture. Video never needs a parallel DOM layer or a transparent hole in the canvas.

`background/showreel/motion.ts` owns deterministic transition state. It uses the presentation clock for the opening wall, focused tile, cut, blackout, and delayed return to pastel. Moving between screens with the same video focus preserves playback and framing. `background/showreel/source.ts` owns video elements, textures, cropping, and the offscreen composition. It creates media resources on mount, pauses covered clips, and releases decoders and GPU resources on cleanup.

Glass materials own optical properties and register while visible. The provider owns capture resolution and scheduling. Captures preserve the scene background and exclude glass and objects marked `EXCLUDE_FROM_BACKDROP` from the clean pass. An optional second pass captures glass back faces. Render targets, object visibility, and material settings are restored even if a pass fails.

Entity renderers query and map to private view components in the same file. `useViewBinding` in `view/hooks.ts` connects a mounted Three object to its entity through `view/actions.ts`. Cleanup releases the registration only if it still refers to that object, so a replaced view cannot be detached by an older callback. Systems query `Ref` to synchronize transforms. Views own their GPU resources and dispose them through React lifecycle cleanup.

Shared loading, warming, and spring functions live in `view/utils/`. Feature-specific geometry and shader construction live in the feature's `utils/` directory. Foreground domain composition lives in root `foreground.tsx`.
