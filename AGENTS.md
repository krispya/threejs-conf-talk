<!-- managed:start -->

## Workspace Tools

- **Package Manager:** pnpm
- **Linter:** oxlint
- **Formatter:** prettier

### After Editing

✅ After editing files, check the types for errors and then format and lint only the files changed for the current task.

```sh
# Example
pnpm typecheck
# Run format and lint for only files modified
pnpm exec prettier --config .config/prettier.json --ignore-path .config/prettierignore --write src/App.tsx src/core/systems/move-entity.ts
pnpm lint -- src/App.tsx src/core/systems/move-entity.ts
```

❌ Avoid unless explicitly approved:

```sh
pnpm format
pnpm lint
```

<!-- managed:end -->

## Testing Principles

Tests are documentation. You can create tests for iteration but they should always be removed when you are done and replaced by minimal tests that document the feature.

- Cover the common paths that represent the 80% of real usage. Add edge-case tests only when the edge case is important or guards against a meaningful regression.
- Test observable features and user stories, not implementation details. Test internals only when an exceptionally difficult case cannot be covered reliably through public behavior.

## Comments

Comments should be concise and relavant to explaining the algorithm or feature. It should not explain changes or a history of the codebase. Comments should serve as documentation. Use simple punctuation. Do not use semicolons or em dashes, for example.

## Trait Naming

- Prefix boolean state tags with `Is`, such as `IsHidden` and `IsDiscovered`. Presence means true and absence means false.
- Use nouns for data traits and entity-kind markers, such as `Position`, `Profile`, and `Charter`.
- Keep traits in the domain that owns their behavior. Use root `src/traits.ts` for common traits without a specific domain owner.

## Domain Boundaries

- Actions are commands on the world and the primary API for changing application state. Perform state machine transitions through actions, then query the resulting state in systems and views.
- Each domain owns its mutations. Cross-domain orchestration calls the owning domain's actions.
- Systems query and advance derived state each frame. They may update continuous simulation data directly, and call actions when a state transition is due.
- Renderers query entities and map them to views. Keep private entity views and small dedicated subcomponents with their renderer. Views own mounted objects, resources, and local visual animation. Bind objects through `useViewBinding` instead of writing `Ref` directly.
- Route frame-driven values through captured object refs and imperative systems. Read current Koota data inside the frame update and mutate objects, materials, or uniforms directly. Do not put continuously changing values into React state or subscribe to them with `useTrait`.
- Use React for query membership, discrete state changes, resource readiness, and view-graph construction. A frame update may notify React once when an exit or preparation completes. Keep animation progress outside React state.
- A `useFrame` callback runs outside React rendering. Keep React glue for reading current world values and synchronizing captured objects or uniforms there. Reusable transition state, timing, and interpolation belong in domain actions and systems. GPU resources remain owned by the view.
- Keep actions, traits, and systems independent of React and mounted views so they can run headless.
- Put reusable geometry, layout, material, and resource helpers in named files under the owning domain's `utils/`. Shared rendering infrastructure belongs in `view/`.
- Keep small supporting types and helpers in the file that owns their behavior. Extract a file when it provides a useful independent boundary, not merely because it contains a type or function.
- Utilities receive explicit inputs. The caller owns allocation lifetime and cleanup. Hooks own React subscriptions and lifecycle.
- Use `useMemo` for derived values and garbage-collectable allocations, not allocation-only `useState`. Reserve state for reactive changes, including resource readiness.
- Render and memo initializers must not allocate GPU resources, start media, or perform other work that needs explicit cleanup. Create those resources in an effect, dispose exactly that setup's resources in cleanup, and gate dependent rendering until they are ready. Effect replay must create a fresh working resource.
- Screen definitions declare typed `requires` labels mapped to domain creation actions. Timeline creation builds each required group once and owns its lifetime. Keep requirements out of runtime screen traits.
- Root modules compose domains. Import symbols directly from their owning files and avoid renderer imports from utilities.

# Const Policy

We want reduce top level const and inline anything that is an explicit hook we need tweak often. Always ask yourself if a const needs to exist before making it. Prefer to inline.
