import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld, Not } from 'koota';
import { Group } from 'three/webgpu';
import { createServer } from 'vite';
import { loadPresentation } from './helpers/load-presentation.mjs';

let server;
let sim;
let viewActions;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  sim = await loadPresentation(server);
  ({ viewActions } = await server.ssrLoadModule('/src/view/actions.ts'));
});

after(async () => {
  await server?.close();
});

void test('screen requirements populate a navigable presentation', (t) => {
  const world = createWorld(sim.Time, sim.Bounds);
  t.after(() => world.destroy());
  const commands = sim.actions(world);
  const timeline = commands.createTimeline(sim.screens);
  assert.equal(timeline.targetFor(sim.ActiveScreen), undefined);
  commands.startTimeline(timeline);
  assert.equal(timeline.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'title');
  assert.equal(world.query(sim.Camera).length, 1);
  assert(world.query(sim.Package).length > 1);
  assert(world.query(sim.Profile).length > 1);
  assert.equal(world.query(sim.Letter).length, 6);

  commands.goTo('letters');
  assert.equal(timeline.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'letters');
  assert.equal(world.query(sim.Package, Not(sim.IsHidden)).length, 0);
  assert.equal(world.query(sim.Letter, Not(sim.IsHidden)).length, 6);
  commands.next();
  assert.equal(timeline.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'profiles');
});

void test('screens share required groups and timeline teardown releases only its entities', (t) => {
  const world = createWorld(sim.Time, sim.Bounds);
  t.after(() => world.destroy());
  const commands = sim.actions(world);
  const unrelated = world.spawn();
  const definitions = [
    {
      id: 'small',
      requires: ['camera', 'packages'],
      lettersVisible: false,
      packageSizing: 'compressed',
      transition: { duration: 1, cameraZ: 12 },
    },
    {
      id: 'large',
      requires: ['camera', 'packages'],
      lettersVisible: false,
      packageSizing: 'proportional',
      transition: { duration: 1, cameraZ: 12 },
    },
  ];
  const timeline = commands.createTimeline(definitions);
  const packages = [...world.query(sim.Package)];
  const owned = [...world.query(sim.OwnedByTimeline(timeline)), ...world.query(sim.Screen)];
  assert.equal(world.query(sim.Camera).length, 1);
  assert.equal(new Set(packages.map((entity) => entity.get(sim.Package).name)).size, packages.length);
  assert.equal(world.query(sim.Profile).length, 0);
  assert.equal(world.query(sim.Letter).length, 0);
  assert.equal(world.query(sim.Title).length, 0);
  assert.equal(world.query(sim.Charter).length, 0);
  assert.equal(world.query(sim.Initiative).length, 0);

  commands.startTimeline(timeline);
  commands.goTo('large');
  assert.equal(timeline.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'large');
  sim.systems.updateTime(world, 1, 1);
  sim.systems.resizePackages(world);
  assert(
    packages.every(
      (entity) => entity.get(sim.Size).radius === entity.get(sim.PackageSizing).proportional
    )
  );
  commands.previous();
  assert.equal(timeline.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'small');
  assert.deepEqual([...world.query(sim.Package)], packages);

  commands.destroyTimeline(timeline);
  assert(!timeline.isAlive());
  assert(owned.every((entity) => !entity.isAlive()));
  assert.equal(world.query(sim.Screen).length, 0);
  assert.equal(world.query(sim.Package).length, 0);
  assert(unrelated.isAlive());

  const restarted = commands.createTimeline(definitions);
  commands.startTimeline(restarted);
  commands.destroyTimeline(timeline);
  assert.equal(world.query(sim.Camera).length, 1);
  assert.equal(world.query(sim.Package).length, packages.length);
  assert.equal(restarted.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'small');
  commands.destroyTimeline(restarted);
});

void test('view cleanup preserves a replacement object and tolerates a destroyed entity', (t) => {
  const world = createWorld();
  t.after(() => world.destroy());
  const entity = world.spawn();
  const { attachView, detachView } = viewActions(world);
  const original = new Group();
  const replacement = new Group();
  attachView(entity, original);
  assert.equal(entity.get(sim.Ref), original);
  attachView(entity, replacement);
  detachView(entity, original);
  assert.equal(entity.get(sim.Ref), replacement);
  detachView(entity, replacement);
  assert(!entity.has(sim.Ref));
  attachView(entity, original);
  entity.destroy();
  assert.doesNotThrow(() => detachView(entity, original));
});
