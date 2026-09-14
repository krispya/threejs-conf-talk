export async function loadPresentation(server) {
  const modules = await Promise.all([
    server.ssrLoadModule('/src/traits.ts'),
    server.ssrLoadModule('/src/floating/traits.ts'),
    server.ssrLoadModule('/src/time/traits.ts'),
    server.ssrLoadModule('/src/view/traits.ts'),
    server.ssrLoadModule('/src/camera/traits.ts'),
    server.ssrLoadModule('/src/charter/traits.ts'),
    server.ssrLoadModule('/src/initiative/traits.ts'),
    server.ssrLoadModule('/src/letter/traits.ts'),
    server.ssrLoadModule('/src/package/traits.ts'),
    server.ssrLoadModule('/src/profile/traits.ts'),
    server.ssrLoadModule('/src/timeline/traits.ts'),
    server.ssrLoadModule('/src/title/traits.ts'),
    server.ssrLoadModule('/src/actions.ts'),
    server.ssrLoadModule('/src/package/utils/sizing.ts'),
    server.ssrLoadModule('/src/timeline/actions.ts'),
    server.ssrLoadModule('/src/timeline/screens.ts'),
    server.ssrLoadModule('/src/timeline/timing.ts'),
    server.ssrLoadModule('/src/timeline/systems.ts'),
    server.ssrLoadModule('/src/profile/utils/motion.ts'),
    server.ssrLoadModule('/src/profile/utils/layout.ts'),
  ]);
  const systems = await Promise.all([
    server.ssrLoadModule('/src/package/systems.ts'),
    server.ssrLoadModule('/src/profile/systems.ts'),
    server.ssrLoadModule('/src/letter/systems.ts'),
    server.ssrLoadModule('/src/camera/systems.ts'),
    server.ssrLoadModule('/src/floating/systems.ts'),
    server.ssrLoadModule('/src/time/systems.ts'),
    server.ssrLoadModule('/src/view/systems.ts'),
  ]);
  return Object.assign({}, ...modules, { systems: Object.assign({}, ...systems) });
}
