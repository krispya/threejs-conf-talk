import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld, Not } from 'koota';
import { Box3, Euler, Matrix4, Vector3 } from 'three/webgpu';
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
  const world = createWorld(sim.Time, sim.Bounds);
  const actions = sim.actions(world);
  const camera = actions.createCamera();
  const letter = actions.createLetter('P', 0);
  const packages = [actions.createPackage('three', 1000, 0, 1)];
  const profiles = [actions.createProfile('drcmda', './profiles/drcmda.png', 0)];
  const timeline = sim.timelineActions(world);

  t.after(() => {
    timeline.stop();
    world.destroy();
  });

  const timelineEntity = timeline.start();
  const intro = timelineEntity.targetFor(sim.FirstScreen);
  const letters = intro.targetFor(sim.NextScreen);
  const contributors = letters.targetFor(sim.NextScreen);
  return {
    world,
    camera,
    letter,
    packages,
    profiles,
    timeline,
    timelineEntity,
    intro,
    letters,
    contributors,
  };
}

function advance(world, seconds, fps = 60) {
  const start = world.get(sim.Time).elapsed;
  for (let frame = 0; frame < seconds * fps; frame++) {
    const elapsed = start + Math.min((frame + 1) / fps, seconds);
    sim.systems.updateTime(world, elapsed - world.get(sim.Time).elapsed, elapsed);
    sim.systems.moveCamera(world);
  }
}

void test('steps to letters and back while preserving the scene entities', (t) => {
  const { world, camera, letter, packages, timeline, timelineEntity, intro, letters } =
    createScene(t);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], packages);
  assert.equal(camera.get(sim.Position).z, 12);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), letters);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  assert.equal(letter.has(sim.Hidden), false);
  assert.equal(camera.get(sim.Position).z, 12);
  advance(world, letters.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 10);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], packages);
  assert.equal(camera.get(sim.Position).z, 10);
  advance(world, intro.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  assert.deepEqual([...world.query(sim.Letter)], [letter]);
});

void test('navigation stops at the ends and supports named screens', (t) => {
  const { world, timeline, timelineEntity, intro, letters, contributors } = createScene(t);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  timeline.goTo('letters');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), contributors);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), contributors);
  timeline.goTo('letters');
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), letters);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  timeline.goTo(intro);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
});

void test('flies through the letters to contributors and returns without recreating profiles', (t) => {
  const { world, camera, letter, profiles, timeline, letters, contributors } = createScene(t);
  assert.equal(world.query(sim.Profile, Not(sim.Hidden)).length, 0);
  timeline.goTo('letters');
  advance(world, letters.get(sim.ScreenTransition).duration);
  timeline.next();
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert.equal(letter.has(sim.Hidden), false);
  advance(world, contributors.get(sim.ScreenTransition).duration);
  world.set(sim.Bounds, { width: 16, height: 9 });
  sim.systems.placeProfiles(world);
  sim.systems.floatBodies(world);
  assert.equal(camera.get(sim.Position).z, -5);
  assert(camera.get(sim.Position).z < letter.get(sim.Position).z);
  assert(profiles.every((entity) => entity.get(sim.Position).z < camera.get(sim.Position).z));

  timeline.previous();
  assert.equal(world.query(sim.Profile, Not(sim.Hidden)).length, 0);
  advance(world, letters.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 10);
  timeline.next();
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
});

void test('the camera eases consistently and reverses smoothly during a transition', (t) => {
  const a = createScene(t);
  const b = createScene(t);
  a.timeline.next();
  b.timeline.next();
  advance(a.world, a.letters.get(sim.ScreenTransition).duration / 2, 30);
  advance(b.world, b.letters.get(sim.ScreenTransition).duration / 2, 120);
  const halfway = a.camera.get(sim.Position).z;
  assert(halfway > 10 && halfway < 12);
  assert(Math.abs(halfway - b.camera.get(sim.Position).z) < 1e-9);

  a.timeline.previous();
  assert.equal(a.camera.get(sim.Position).z, halfway);
  advance(a.world, 1 / 60);
  assert(a.camera.get(sim.Position).z > halfway);
  assert(a.camera.get(sim.Position).z < 12);
  advance(a.world, a.intro.get(sim.ScreenTransition).duration);
  assert.equal(a.camera.get(sim.Position).z, 12);
});

void test('floating portraits stay in separate depth layers', async (t) => {
  const { world, timeline } = createScene(t);
  const { profiles } = await server.ssrLoadModule('/src/data/profiles.ts');
  const { createProfile } = sim.actions(world);
  profiles
    .slice(1)
    .forEach((profile, index) => createProfile(profile.login, profile.avatar, index + 1));
  world.set(sim.Bounds, { width: 16, height: 9 });
  timeline.goTo('profiles');
  sim.systems.placeProfiles(world);

  for (let elapsed = 0; elapsed <= 120; elapsed += 0.25) {
    sim.systems.updateTime(world, 0.25, elapsed);
    sim.systems.floatBodies(world);
    const layers = world
      .query(sim.Profile, sim.Size, sim.Position, sim.Rotation)
      .map((entity) => {
        const radius = entity.get(sim.Size).radius + 0.025;
        const position = entity.get(sim.Position);
        const rotation = entity.get(sim.Rotation);
        const transform = new Matrix4()
          .makeRotationFromEuler(new Euler(rotation.x, rotation.y, rotation.z))
          .setPosition(position.x, position.y, position.z);
        return new Box3(
          new Vector3(-radius, -radius, -0.01),
          new Vector3(radius, radius, 0)
        ).applyMatrix4(transform);
      })
      .sort((a, b) => a.min.z - b.min.z);

    for (let i = 1; i < layers.length; i++) {
      assert(layers[i - 1].max.z < layers[i].min.z, `Portraits intersect at ${elapsed}s`);
    }
  }
});

void test('entering applies the destination screen data in either direction', (t) => {
  const { world, camera, timeline, intro, letters } = createScene(t);
  intro.set(sim.Screen, { packagesVisible: false });
  letters.set(sim.Screen, { packagesVisible: true });
  intro.set(sim.ScreenTransition, { duration: 0.8, cameraX: -1, cameraY: 2, cameraZ: 13 });
  letters.set(sim.ScreenTransition, { duration: 0.2, cameraX: 1, cameraY: -2, cameraZ: 8 });
  timeline.next();
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: 12 });
  advance(world, 0.1);
  assert(camera.get(sim.Position).z > 8);
  assert(camera.get(sim.Position).z < 12);
  advance(world, 0.1);
  assert.deepEqual(camera.get(sim.Position), { x: 1, y: -2, z: 8 });

  timeline.previous();
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  advance(world, 0.4);
  assert(camera.get(sim.Position).z > 8);
  assert(camera.get(sim.Position).z < 13);
  advance(world, 0.4);
  assert.deepEqual(camera.get(sim.Position), { x: -1, y: 2, z: 13 });
});

void test('stopping cleans up the screen and allows a fresh start', (t) => {
  const { world, timeline, timelineEntity, intro } = createScene(t);
  timeline.next();
  timeline.stop();
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), undefined);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
  assert.equal(timeline.start(), timelineEntity);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  timeline.next();
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);

  timeline.stop();
  assert.equal(world.query(sim.Profile, Not(sim.Hidden)).length, 0);
  timelineEntity.destroy();
  assert.equal(world.query(sim.Screen).length, 0);
  const restarted = timeline.start();
  assert.equal(world.query(sim.Screen).length, 3);
  assert.equal(restarted.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'intro');
});
