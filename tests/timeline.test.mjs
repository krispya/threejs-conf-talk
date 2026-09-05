import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld, Not } from 'koota';
import { createServer } from 'vite';

let server;
let sim;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
  });
  sim = await server.ssrLoadModule('/src/sim/index.ts');
});

after(async () => {
  await server?.close();
});

function createScene(t) {
  const world = createWorld(sim.Time, sim.Bounds, sim.Timeline);
  const actions = sim.actions(world);
  const camera = actions.createCamera();
  const letter = actions.createLetter('P', 0);
  const packages = [actions.createPackage('three', 1000, 0, 1)];
  const timeline = sim.timelineActions(world);

  t.after(() => {
    timeline.stop();
    world.destroy();
  });

  timeline.start();
  return { world, camera, letter, packages, timeline };
}

function advance(world, seconds, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame++) {
    sim.systems.updateTime(world, 1 / fps, (frame + 1) / fps);
    sim.systems.moveCamera(world);
  }
}

void test('steps to letters and back while preserving the scene entities', (t) => {
  const { world, camera, letter, packages, timeline } = createScene(t);
  assert.equal(sim.screens[world.get(sim.Timeline).index].id, 'intro');
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], packages);
  assert.equal(camera.get(sim.Position).z, 12);

  timeline.next();
  assert.equal(sim.screens[world.get(sim.Timeline).index].id, 'letters');
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  assert.equal(letter.has(sim.Hidden), false);
  assert.equal(camera.get(sim.Position).z, 12);
  advance(world, 3);
  assert.equal(camera.get(sim.Position).z, 10);

  timeline.previous();
  assert.equal(sim.screens[world.get(sim.Timeline).index].id, 'intro');
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], packages);
  assert.equal(camera.get(sim.Position).z, 10);
  advance(world, 3);
  assert.equal(camera.get(sim.Position).z, 12);
  assert.deepEqual([...world.query(sim.Letter)], [letter]);
});

void test('navigation stops at the ends and supports named screens', (t) => {
  const { world, timeline } = createScene(t);
  timeline.previous();
  assert.equal(world.get(sim.Timeline).index, 0);
  timeline.goTo('letters');
  timeline.next();
  timeline.goTo('letters');
  assert.equal(world.get(sim.Timeline).index, 1);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  timeline.goTo('intro');
  assert.equal(world.get(sim.Timeline).index, 0);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
});

void test('the camera eases consistently and reverses smoothly during a transition', (t) => {
  const a = createScene(t);
  const b = createScene(t);
  a.timeline.next();
  b.timeline.next();
  advance(a.world, 0.5, 30);
  advance(b.world, 0.5, 120);
  const halfway = a.camera.get(sim.Position).z;
  assert(halfway > 10 && halfway < 12);
  assert(Math.abs(halfway - b.camera.get(sim.Position).z) < 1e-9);

  a.timeline.previous();
  assert.equal(a.camera.get(sim.Position).z, halfway);
  advance(a.world, 1 / 60);
  assert(a.camera.get(sim.Position).z > halfway);
  assert(a.camera.get(sim.Position).z < 12);
});

void test('stopping cleans up the screen and allows a fresh start', (t) => {
  const { world, timeline } = createScene(t);
  timeline.next();
  timeline.stop();
  timeline.next();
  assert.equal(world.get(sim.Timeline).index, -1);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
  timeline.start();
  assert.equal(world.get(sim.Timeline).index, 0);
  timeline.next();
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
});
