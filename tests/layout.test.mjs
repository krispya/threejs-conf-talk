import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld } from 'koota';
import { createServer } from 'vite';

let server;
let sim;
let trails;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  sim = await server.ssrLoadModule('/src/sim/index.ts');
  trails = await server.ssrLoadModule('/src/view/title-trails.ts');
});

after(async () => {
  await server?.close();
});

function createProfiles(t) {
  const world = createWorld(sim.Time, sim.Bounds({ width: 16, height: 9 }));
  t.after(() => world.destroy());
  const actions = sim.actions(world);
  const camera = actions.createCamera();
  const profiles = Array.from({ length: 8 }, (_, i) => actions.createProfile(`profile-${i}`, '', i));
  const screen = world.spawn(
    sim.Screen({ profilesVisible: true }),
    sim.ScreenTransition({ cameraZ: 8 })
  );
  return { world, actions, camera, profiles, screen };
}

void test('portrait packing stays deterministic and refreshes after framing or population changes', (t) => {
  const { world, actions, camera, profiles, screen } = createProfiles(t);
  const layout = sim.systems.createProfileLayout(9);
  const anchors = () => world.query(sim.Profile, sim.Anchor).map((entity) => entity.get(sim.Anchor));
  assert(sim.systems.placeProfiles(world, layout));
  const original = anchors();
  world.set(sim.Time, { elapsed: 10 });
  camera.set(sim.Position, { z: 120 });
  assert(sim.systems.placeProfiles(world, layout));
  assert.deepEqual(anchors(), original, 'Camera travel preserves the destination layout');

  for (const change of [
    () => world.set(sim.Bounds, { width: 9, height: 16 }),
    () => camera.set(sim.Camera, { fov: 60 }),
    () => screen.set(sim.ScreenTransition, { cameraX: 3, cameraY: -2, cameraZ: 20 }),
    () => profiles[0].set(sim.Anchor, { z: -30 }),
    () => profiles[1].set(sim.Size, { radius: 1.2 }),
    () => profiles[2].set(sim.Float, { amplitude: 0.3 }),
    () => profiles[3].set(sim.Profile, { index: 20 }),
    () => profiles[4].destroy(),
    () => actions.createProfile('replacement', '', 4),
  ]) {
    change();
    assert(sim.systems.placeProfiles(world, layout));
    const cached = anchors();
    assert(sim.systems.placeProfiles(world, sim.systems.createProfileLayout(9)));
    assert.deepEqual(cached, anchors(), 'A reused workspace matches a fresh layout');
  }
});

void test('portrait packing preserves anchors when capacity or framing is invalid and recovers', (t) => {
  const { world, profiles } = createProfiles(t);
  const layout = sim.systems.createProfileLayout(8);
  assert(sim.systems.placeProfiles(world, layout));
  const original = profiles.map((entity) => entity.get(sim.Anchor));
  assert.equal(sim.systems.placeProfiles(world, sim.systems.createProfileLayout(7)), false);
  assert.deepEqual(
    profiles.map((entity) => entity.get(sim.Anchor)),
    original
  );
  for (const height of [0, NaN]) {
    world.set(sim.Bounds, { height });
    assert.equal(sim.systems.placeProfiles(world, layout), false);
    assert.deepEqual(
      profiles.map((entity) => entity.get(sim.Anchor)),
      original
    );
  }
  world.set(sim.Bounds, { height: 9 });
  profiles[0].set(sim.Anchor, { z: 8 });
  assert.equal(sim.systems.placeProfiles(world, layout), false);
  profiles[0].set(sim.Anchor, { z: original[0].z });
  assert(sim.systems.placeProfiles(world, layout));
  assert.deepEqual(
    profiles.map((entity) => entity.get(sim.Anchor)),
    original
  );
  for (const entity of profiles) entity.destroy();
  assert(sim.systems.placeProfiles(world, sim.systems.createProfileLayout(0)));
});

void test('title trails point outward, scale with viewport pixels, and reveal in density bands', () => {
  const state = trails.createTitleTrails(480, () => 0.25);
  const buffer = state.matrices;
  assert.equal(trails.updateTitleTrails(state, 0, 1, 16, 9, 900, -30, 0.5), state);
  assert.equal(state.count, 480);
  const matrix = buffer.slice(0, 16);
  assert(Math.abs(matrix[0]) < 1e-6, 'A quarter turn points straight up');
  assert(matrix[1] > 0 && matrix[4] < 0);
  assert(Math.abs(matrix[12]) < 1e-6 && matrix[13] > 9 * 0.5 * 0.5);
  assert.equal(matrix[14], -30);
  assert(buffer[288 * 16 + 4] === 0, 'Outer trails wait for warp');

  trails.updateTitleTrails(state, 0, 4, 16, 9, 900, -30, 0.5);
  assert(buffer[288 * 16 + 4] < 0, 'Warp reveals the outer band');
  trails.updateTitleTrails(state, 0, 1, 32, 18, 900, -30, 0.5);
  assert(Math.abs(buffer[13] - matrix[13] * 2) < 1e-5);
  assert(Math.abs(buffer[4] - matrix[4] * 2) < 1e-5);
  assert.equal(state.matrices, buffer, 'Updates retain the GPU buffer');

  trails.updateTitleTrails(state, 0, 1, 16, 9, 0, -30, 0.5);
  assert.equal(state.count, 0);
  trails.updateTitleTrails(state, NaN, 1, 16, 9, 900, -30, 0.5);
  assert.equal(state.count, 0);
  trails.updateTitleTrails(state, 0, 1, 16, 9, 900, -30, 0.5);
  assert.equal(state.count, 480);
  assert.deepEqual(buffer.slice(0, 16), matrix);
  const empty = trails.createTitleTrails(0);
  trails.updateTitleTrails(empty, 0, 1, 16, 9, 900, -30, 0.5);
  assert.equal(empty.count, 0);
});
