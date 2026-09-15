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

- Each domain owns its state and mutations. Use its actions for state transitions and cross-domain changes. Systems advance continuous state each frame.
- Renderers map entities to views. Views own mounted objects, visual resources, and local animation. Keep domain logic independent of React and mounted views.
- Use React for structure, discrete changes, and resource readiness. Read current world data during frame updates and mutate objects or uniforms directly. Keep continuous animation out of React state and subscriptions.
- Keep local frame work in the view, including built-in `useFrame` stages. Centralize shared system ordering in `frameloop.tsx`.
- Keep render and memo initializers free of work that needs cleanup. Create owned GPU resources and media in effects, with matching cleanup that supports effect replay.
- Utilities take explicit inputs. Callers own resource lifetimes, and hooks own React subscriptions and lifecycle.

# Const Policy

We want reduce top level const and inline anything that is an explicit hook we need tweak often. Always ask yourself if a const needs to exist before making it. Prefer to inline.
