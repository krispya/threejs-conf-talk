# Structure

Each domain owns its data, traits, actions, systems, and rendering. Import directly from the file that owns a symbol. Domains only need the files they use.

```text
src/
  package/
    comparison/
      data.ts
      renderer.tsx
    utils/
      sizing.ts
      maintainer-layout.ts
    data.ts
    traits.ts
    actions.ts
    systems.ts
    renderer.tsx
  profile/
  letter/
  title/
  camera/
  initiative/
    benchmark/
    utils/
  introduction/
  charter/
    principles/
    utils/
  timeline/
  background/
    showreel/
    utils/
  floating/
  time/
  robot/
  closing/
  view/
    glass/
    utils/
  actions.ts
  foreground.tsx
  frameloop.tsx
  renderers.tsx
  startup.tsx
  traits.ts
  world.ts
```

# State and commands

Traits describe entity state. Actions are commands on the world and the main API for effecting changes. State machine transitions happen through actions, and systems and views query the resulting state to react.

`timeline/actions.ts` owns screen navigation and transition timing. It calls domain actions to apply the destination's visibility, package sizing, profile focus, and camera target, then updates `ActiveScreen`. `timeline/systems.ts` queries elapsed time and calls the navigation command when an automatic transition is due. Other systems continuously derive positions, sizes, and transforms from the queried state.

`actions.ts` composes domain commands. `startup.tsx` calls `createTimeline(screens)`, then `startTimeline(timeline)`, and calls `destroyTimeline(timeline)` on cleanup. Controls call navigation commands. `timeline/hooks.ts` provides `useActiveScreen` for reactive screen queries without subscribing to the per-frame clock.

Screen definitions declare typed `requires` labels such as `camera`, `packages`, and `profiles`. `timeline/actions.ts` maps those labels to domain creation actions. `ScreenDefinition` lives alongside the data in `timeline/screens.ts`, while runtime screen state remains in traits.

```ts
{
  id: 'package-sizes',
  requires: ['camera', 'letters', 'packages'],
  packageSizing: 'proportional',
  transition: { duration: 1.4, cameraZ: 12 },
}
```

`createTimeline` builds each required group once across the supplied sequence and links its screens in order. It does not activate a screen until `startTimeline` runs. Multiple screens use the same entities so forward and backward transitions preserve identity and motion. Requirements describe entity groups, not every visual component on the screen.

The world supports one timeline at a time. Created groups carry `OwnedByTimeline` and screens carry `ScreenOf`. Both relations destroy their source entities when the timeline is destroyed. `stopTimeline` resets presentation state while retaining entities for a restart. `destroyTimeline` stops it and releases its screens and groups. Requirements are construction metadata and are not copied into runtime screen traits.

A trait stays with the domain that owns its behavior even when other domains use it. Root `traits.ts` contains only `Position`, `Rotation`, `Size`, and `IsHidden`. `time` owns `Time`, `camera` owns bounds and targets, `floating` owns anchors and drift, `package` owns size transitions, and `timeline` owns transition origins.

Boolean state tags use the `Is` prefix, such as `IsHidden` and `IsDiscovered`. Presence means true and absence means false. Data traits and entity-kind markers use nouns, such as `Position`, `Profile`, and `Charter`.

# Rendering and utilities

An entity renderer queries and maps entities to private view components in the same `renderer.tsx` file. Views own mounted objects and visual animation. Screen renderers keep their small, dedicated components alongside the composition. Separate components remain useful when they represent substantial behavior, such as the charter collapse or profile connections. Visual state such as shader uniforms and temporary animation values stays local to the view.

`view/hooks.ts` owns entity visibility subscriptions and mounted-object binding through view actions. `view/systems.ts` copies simulation transforms to the object held in `Ref`. The mounted view owns its object's lifetime.

Group related helpers by responsibility. Profile layout and motion live in `profile/utils/layout.ts` and `motion.ts`; package dimensions live in `package/utils/sizing.ts`. Portal resources and motion live in `initiative/utils/portal.ts` and `portal-motion.ts`. The charter collapse and robot each have a resource utility module. Small material definitions used by one renderer stay with that renderer. Substantial geometry, material-node, resource, and layout helpers live in named domain `utils/` files. They receive explicit inputs and their callers own resource lifetime and disposal. React hooks retain subscriptions and lifecycle. Shared GPU support, object binding, loading, warming, and arrival motion belong in `view/`. The shared arrival curve is in `view/utils/spring.ts`.

Root `frameloop.tsx` orders systems, `foreground.tsx` composes foreground domains, and `renderers.tsx` assembles the scene and Suspense boundaries. `background` owns the backdrop, gradient utilities, and showreel.

`introduction` owns the greeting and history. The charter owns its principles sequence, packages own the code comparison, and initiatives own the benchmarks shown inside the portal.

Keep traits, actions, and systems independent of React and mounted views so they can run headless. Integration tests compose domain modules with `tests/helpers/load-presentation.mjs`.
