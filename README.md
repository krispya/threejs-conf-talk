# threejs-conf-talk

This project was generated with create-krispya

## Project Architecture

This project uses [Vite](https://vitejs.dev/) as the bundler for fast development and optimized production builds.

- `src/app.tsx` defines the main application component containing your 3D content
- `src/main.tsx` renders the React app into the DOM
- `src/theme.ts` records the brand fonts and colors
- `src/sim/` is the Koota data model: `traits/`, `actions.ts`, and one file per system in `systems/`
- `src/view/` projects the data model into React Three Fiber: `frameloop.tsx` runs the systems in `useFrame`, `renderers/` render entities, `startup.tsx` spawns them
- `tests/` contains your test files
- Static assets can be placed in the `public` folder

## Fonts

Text is rendered with [@pmndrs/glyph](https://github.com/pmndrs/glyph) from baked font GLBs in `public/fonts`.
Sources (Geist Bold, Geist Mono Medium) and their OFL license sit beside the baked files.
Run `pnpm bake` after changing a source font or the baked unicode range.

## Libraries

The following libraries are used - checkout the linked docs to learn more

- [React](https://react.dev/) - A JavaScript library for building user interfaces
- [Three.js](https://threejs.org/) - JavaScript 3D library
- [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) - lets you create Three.js scenes using React components (v10, WebGPU entry)
- [Koota](https://github.com/pmndrs/koota) - ECS data model driving the simulation
- [@pmndrs/glyph](https://github.com/pmndrs/glyph) - batched MSDF text rendering

## Tools

- [Oxlint](https://oxc.rs/docs/guide/usage/linter) - A fast linter for JavaScript and TypeScript
- [Prettier](https://prettier.io/) - Opinionated code formatter

## Development Commands

- `pnpm install` to install the dependencies
- `pnpm run dev` to run the development server and preview the app with live updates
- `pnpm run build` to build the app into the `dist` folder
- `pnpm run test` to run the tests
