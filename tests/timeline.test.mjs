import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld, Not } from 'koota';
import { Box3, Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three/webgpu';
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
  const title = actions.createTitle();
  const charter = actions.createCharter();
  const initiatives = actions.createInitiatives();
  const letter = actions.createLetter('P', 0);
  const packages = [actions.createPackage('zustand', 54_493_939, 0, 1.4, 2.8)];
  const profiles = [actions.createProfile('drcmda', './profiles/drcmda.png', 0)];
  const principlesConstellation = actions.createPrinciplesConstellation();
  const timeline = sim.timelineActions(world);

  t.after(() => {
    timeline.stop();
    world.destroy();
  });

  const timelineEntity = timeline.start();
  const titleScreen = timelineEntity.targetFor(sim.FirstScreen);
  const intro = titleScreen.targetFor(sim.NextScreen);
  const comparison = intro.targetFor(sim.NextScreen);
  const threeFeatures = comparison.targetFor(sim.NextScreen);
  const packageSizes = threeFeatures.targetFor(sim.NextScreen);
  const letters = packageSizes.targetFor(sim.NextScreen);
  const contributors = letters.targetFor(sim.NextScreen);
  const constellation = contributors.targetFor(sim.NextScreen);
  const principlesScreen = constellation.targetFor(sim.NextScreen);
  const charterScreen = principlesScreen.targetFor(sim.NextScreen);
  const initiativesScreen = charterScreen.targetFor(sim.NextScreen);
  return {
    world,
    camera,
    title,
    titleScreen,
    charter,
    initiatives,
    letter,
    packages,
    profiles,
    timeline,
    timelineEntity,
    intro,
    comparison,
    threeFeatures,
    packageSizes,
    letters,
    contributors,
    constellation,
    principlesConstellation,
    principlesScreen,
    charterScreen,
    initiativesScreen,
  };
}

function advance(world, seconds, fps = 60) {
  const start = world.get(sim.Time).elapsed;
  for (let frame = 0; frame < seconds * fps; frame++) {
    const elapsed = start + Math.min((frame + 1) / fps, seconds);
    sim.systems.updateTime(world, elapsed - world.get(sim.Time).elapsed, elapsed);
    sim.systems.moveCamera(world);
    sim.systems.resizePackages(world);
    sim.systems.layoutConstellations(world);
  }
}

void test('moves through counts, code, and Three features before showing all packages', (t) => {
  const {
    world,
    camera,
    title,
    titleScreen,
    letter,
    packages,
    timeline,
    timelineEntity,
    intro,
    comparison,
    threeFeatures,
    packageSizes,
    letters,
  } = createScene(t);
  const featured = [
    sim.actions(world).createPackage('react-three-fiber', 5_129_998, 1, 1.1, 0.86, 'R3F'),
    sim.actions(world).createPackage('three', 15_193_062, 2, 1.2, 1.48, 'Three'),
  ];
  for (const entity of featured) entity.add(sim.Hidden);
  const allPackages = [...packages, ...featured];
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  assert.equal(title.get(sim.Title).text.replaceAll('\n', ' '), 'Beyond React Three Fiber');
  assert.equal(titleScreen.get(sim.Screen).background, 'solid');
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert.equal(intro.get(sim.Screen).background, titleScreen.get(sim.Screen).background);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  world.set(sim.Bounds, { width: 16, height: 9 });
  advance(world, intro.get(sim.ScreenTransition).duration);
  sim.systems.placePackages(world);
  sim.systems.floatBodies(world);
  assert(featured[0].get(sim.Position).x < 0);
  assert(featured[1].get(sim.Position).x > 0);
  assert(featured[1].get(sim.Size).radius > featured[0].get(sim.Size).radius);
  assert(featured.every((entity) => entity.get(sim.Position).z > letter.get(sim.Position).z));
  assert.equal(camera.get(sim.Position).z, 12);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), comparison);
  assert.equal(comparison.get(sim.Screen).codeComparisonVisible, true);
  assert.equal(comparison.get(sim.Screen).background, 'solid');
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));
  advance(world, comparison.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  timeline.next();
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), threeFeatures);
  assert.equal(threeFeatures.get(sim.Screen).packageDownloadsVisible, false);
  assert.equal(threeFeatures.get(sim.Screen).packageFeaturesVisible, true);
  assert.equal(threeFeatures.get(sim.Screen).codeComparisonVisible, false);
  assert(!title.has(sim.Hidden));
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  advance(world, threeFeatures.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageSizes);
  assert(title.has(sim.Hidden));
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(allPackages));
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), letters);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  assert.equal(letter.has(sim.Hidden), false);
  assert.equal(camera.get(sim.Position).z, 12);
  advance(world, letters.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 8);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageSizes);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(allPackages));
  assert.equal(camera.get(sim.Position).z, 8);
  advance(world, packageSizes.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  assert.deepEqual([...world.query(sim.Letter)], [letter]);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), threeFeatures);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), comparison);
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));
  timeline.previous();
  assert(!title.has(sim.Hidden));
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  assert.deepEqual([...world.query(sim.Title, Not(sim.Hidden))], [title]);
  assert(allPackages.every((entity) => entity.isAlive() && entity.has(sim.Hidden)));
});

void test('navigation stops at the ends and supports named screens', (t) => {
  const {
    world,
    timeline,
    timelineEntity,
    titleScreen,
    intro,
    letters,
    contributors,
    constellation,
    principlesScreen,
    charterScreen,
    initiativesScreen,
  } = createScene(t);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  timeline.goTo('letters');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), contributors);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), constellation);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), principlesScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), charterScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiatives');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiatives');
  timeline.goTo('letters');
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), letters);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  timeline.goTo(intro);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
});

void test('resizes packages from compressed to proportional sizes and reverses without jumping', (t) => {
  const { world, camera, packages, timeline, intro, packageSizes } = createScene(t);
  intro.set(sim.Screen, { packageSizing: 'compressed', packageNames: [] });
  timeline.goTo('intro');
  const largest = packages[0];
  const runnerUp = sim
    .actions(world)
    .createPackage(
      'use-gesture',
      6_814_965,
      1,
      sim.compressedRadiusForDownloads(6_814_965, 13_025, 54_493_939),
      sim.radiusForDownloads(6_814_965, 54_493_939)
    );
  const compressed = runnerUp.get(sim.Size).radius;
  assert.equal(intro.get(sim.Screen).packageSizing, 'compressed');
  assert.equal(largest.get(sim.Size).radius, 1.4);

  timeline.goTo('package-sizes');
  assert.equal(packageSizes.get(sim.Screen).packageSizing, 'proportional');
  assert.equal(largest.get(sim.Size).radius, 1.4);
  advance(world, packageSizes.get(sim.ScreenTransition).duration / 2);
  const midway = largest.get(sim.Size).radius;
  assert(midway > 1.4 && midway < 2.8);
  assert(runnerUp.get(sim.Size).radius < compressed);
  assert.equal(camera.get(sim.Position).z, 12);

  timeline.goTo('intro');
  assert.equal(largest.get(sim.Size).radius, midway);
  advance(world, 1 / 60);
  assert(largest.get(sim.Size).radius < midway);
  advance(world, intro.get(sim.ScreenTransition).duration);
  assert.equal(largest.get(sim.Size).radius, 1.4);
  assert.equal(runnerUp.get(sim.Size).radius, compressed);

  timeline.goTo('package-sizes');
  advance(world, packageSizes.get(sim.ScreenTransition).duration);
  assert.equal(largest.get(sim.Size).radius, 2.8);
  const areaRatio = (largest.get(sim.Size).radius / runnerUp.get(sim.Size).radius) ** 2;
  assert(Math.abs(areaRatio - 54_493_939 / 6_814_965) < 1e-9);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], [largest, runnerUp]);

  timeline.next();
  assert(largest.has(sim.Hidden));
  timeline.previous();
  advance(world, packageSizes.get(sim.ScreenTransition).duration);
  assert.equal(largest.get(sim.Size).radius, 2.8);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], [largest, runnerUp]);
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
  assert.equal(camera.get(sim.Position).z, 8);
  timeline.next();
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
});

void test('the camera eases consistently and reverses smoothly during a transition', (t) => {
  const a = createScene(t);
  const b = createScene(t);
  a.timeline.goTo('letters');
  b.timeline.goTo('letters');
  advance(a.world, a.letters.get(sim.ScreenTransition).duration / 2, 30);
  advance(b.world, b.letters.get(sim.ScreenTransition).duration / 2, 120);
  const halfway = a.camera.get(sim.Position).z;
  assert(halfway > 8 && halfway < 12);
  assert(Math.abs(halfway - b.camera.get(sim.Position).z) < 1e-9);

  a.timeline.previous();
  assert.equal(a.camera.get(sim.Position).z, halfway);
  advance(a.world, 1 / 60);
  assert(a.camera.get(sim.Position).z > halfway);
  assert(a.camera.get(sim.Position).z < 12);
  advance(a.world, a.packageSizes.get(sim.ScreenTransition).duration);
  assert.equal(a.camera.get(sim.Position).z, 12);
});

void test('pulls far back while keeping PMNDRS and its contributors visible', (t) => {
  const { world, camera, letter, packages, profiles, timeline, contributors, constellation } =
    createScene(t);
  timeline.goTo('profiles');
  advance(world, contributors.get(sim.ScreenTransition).duration);
  timeline.next();
  assert([letter, ...profiles].every((entity) => !entity.has(sim.Hidden)));
  assert(packages.every((entity) => entity.has(sim.Hidden)));
  assert.equal(constellation.get(sim.Screen).backgroundVisible, true);
  assert.equal(constellation.get(sim.Screen).background, 'stars');
  advance(world, constellation.get(sim.ScreenTransition).duration / 2);
  const midway = camera.get(sim.Position).z;
  assert(midway > 12 && midway < 120);

  timeline.previous();
  assert.equal(camera.get(sim.Position).z, midway);
  assert.equal(letter.has(sim.Hidden), false);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert.equal(contributors.get(sim.Screen).backgroundVisible, true);
  assert.equal(contributors.get(sim.Screen).background, 'pastel');
  advance(world, contributors.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, -5);

  timeline.next();
  advance(world, constellation.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 120);
  assert([letter, ...profiles].every((entity) => entity.isAlive() && !entity.has(sim.Hidden)));
  assert(profiles.every((entity) => camera.get(sim.Camera).far > 120 - entity.get(sim.Anchor).z));
});

void test('profiles keep drifting in space while the letters stay stable', (t) => {
  const { world, camera, letter, profiles, timeline } = createScene(t);
  timeline.goTo('package-sizes');
  world.set(sim.Bounds, { width: 16, height: 9 });
  for (const entity of [letter, ...profiles]) entity.set(sim.Float, { phase: 1, speed: 0.4 });
  sim.systems.updateAnchors(world);
  sim.systems.placeProfiles(world);

  const motionOnScreen = (entity) => {
    const view = new PerspectiveCamera(camera.get(sim.Camera).fov, 16 / 9, 0.1, 500);
    view.position.z = camera.get(sim.Position).z;
    view.updateMatrixWorld();
    const points = [100, 102].map((elapsed) => {
      sim.systems.updateTime(world, 0, elapsed);
      sim.systems.floatBodies(world);
      const { x, y, z } = entity.get(sim.Position);
      return new Vector3(x, y, z).project(view);
    });
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  };

  const letterMotion = motionOnScreen(letter);
  timeline.goTo('profiles');
  advance(world, 3);
  const profileMotion = motionOnScreen(profiles[0]);
  timeline.goTo('constellation');
  advance(world, 3);
  const distantLetterMotion = motionOnScreen(letter);
  assert(distantLetterMotion > 0, 'The letters should retain a gentle float');
  assert(distantLetterMotion < letterMotion / 3, 'The distant word should stay stable');
  const distantProfileMotion = motionOnScreen(profiles[0]);
  assert(distantProfileMotion > 0.01, 'Portrait drift should remain visible in the viewport');
  assert(Math.abs(distantProfileMotion / profileMotion - 1) < 0.05);

  const before = { ...profiles[0].get(sim.Position) };
  timeline.previous();
  sim.systems.floatBodies(world);
  assert.deepEqual(profiles[0].get(sim.Position), before);
  advance(world, 3);
  assert(Math.abs(motionOnScreen(profiles[0]) - profileMotion) < 1e-9);
});

void test('travel to the principles star map and return smoothly to the wide view', (t) => {
  const { world, camera, letter, profiles, timeline, principlesConstellation, principlesScreen } =
    createScene(t);
  const stars = [
    ...world.query(sim.Principle, sim.Star, sim.ConstellationMember(principlesConstellation)),
  ];
  assert.deepEqual(
    stars.map((star) => star.get(sim.Principle).title),
    ['Simple', 'Pragmatic', 'Stable', 'Open']
  );
  assert(stars.every((star) => star.has(sim.Hidden)));
  const connections = stars.flatMap((star) => star.targetsFor(sim.ConnectedTo));
  assert.equal(connections.length, 5);
  assert(
    stars.every((star) => connections.includes(star) || star.targetsFor(sim.ConnectedTo).length > 0)
  );

  timeline.goTo('constellation');
  advance(world, 3);
  assert(!principlesConstellation.has(sim.Hidden));
  assert(stars.every((star) => !star.has(sim.Hidden)));

  world.set(sim.Bounds, { width: 16, height: 9 });
  sim.systems.floatBodies(world);
  const overview = new PerspectiveCamera(camera.get(sim.Camera).fov, 16 / 9, 0.1, 500);
  overview.position.copy(camera.get(sim.Position));
  overview.updateMatrixWorld();
  const pmndrsOverview = new Vector3().copy(letter.get(sim.Position)).project(overview);
  assert(Math.abs(pmndrsOverview.x) < 0.85 && Math.abs(pmndrsOverview.y) < 0.85);
  const compact = stars.map((star) => ({ ...star.get(sim.Anchor) }));
  assert.equal(principlesScreen.get(sim.Screen).constellationMap, true);
  for (const star of stars) {
    const point = new Vector3()
      .copy(star.get(sim.Position))
      .add(principlesConstellation.get(sim.Position))
      .project(overview);
    assert(
      Math.abs(point.x) < 0.85 && Math.abs(point.y) < 0.85,
      'All four stars should fit in the night sky'
    );
  }
  timeline.next();
  assert(!principlesConstellation.has(sim.Hidden));
  assert(stars.every((star) => !star.has(sim.Hidden)));
  assert([letter, ...profiles].every((entity) => !entity.has(sim.Hidden)));
  const destination = principlesScreen.get(sim.ScreenTransition);
  advance(world, destination.duration / 2);
  const halfway = { ...camera.get(sim.Position) };
  assert(halfway.x > overview.position.x && halfway.x < destination.cameraX);
  assert(halfway.z < overview.position.z && halfway.z > destination.cameraZ);
  const halfwayAnchors = stars.map((star) => ({ ...star.get(sim.Anchor) }));
  assert(halfwayAnchors[0].x < compact[0].x);
  assert(halfwayAnchors[0].y > compact[0].y);

  timeline.previous();
  assert.deepEqual(camera.get(sim.Position), halfway);
  assert.deepEqual(
    stars.map((star) => star.get(sim.Anchor)),
    halfwayAnchors
  );
  assert(stars.every((star) => !star.has(sim.Hidden) && star.isAlive()));
  advance(world, 3);
  assert.equal(camera.get(sim.Position).x, 0);
  assert.deepEqual(
    stars.map((star) => star.get(sim.Anchor)),
    compact
  );
  timeline.next();
  advance(world, destination.duration);
  assert.deepEqual(camera.get(sim.Position), {
    x: destination.cameraX,
    y: destination.cameraY,
    z: destination.cameraZ,
  });
  assert.deepEqual([...world.query(sim.Principle)], stars);
  const expanded = stars.map((star) => star.get(sim.Anchor));
  const width = (points) =>
    Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
  assert(
    width(expanded) > width(compact) * 2,
    'The map should spread out beyond its compact sky footprint'
  );

  world.set(sim.Bounds, { width: 16, height: 9 });
  sim.systems.updateAnchors(world);
  sim.systems.placeProfiles(world);
  sim.systems.floatBodies(world);
  const view = new PerspectiveCamera(camera.get(sim.Camera).fov, 16 / 9, 0.1, 500);
  view.position.copy(camera.get(sim.Position));
  view.updateMatrixWorld();
  const origin = principlesConstellation.get(sim.Position);
  for (const star of stars) {
    const point = star.get(sim.Position);
    const projected = new Vector3(point.x + origin.x, point.y + origin.y, point.z + origin.z).project(
      view
    );
    assert(Math.abs(projected.x) < 0.8 && Math.abs(projected.y) < 0.8);
  }
  const pmndrs = new Vector3().copy(letter.get(sim.Position)).project(view);
  assert(
    Math.abs(pmndrs.x) > 1 || Math.abs(pmndrs.y) > 1 || pmndrs.z > 1,
    'Traveling to the principles should leave PMNDRS outside the map framing'
  );

  timeline.goTo('profiles');
  assert(principlesConstellation.has(sim.Hidden));
  assert(stars.every((star) => star.has(sim.Hidden) && star.isAlive()));
  principlesConstellation.destroy();
  assert(stars.every((star) => !star.isAlive()));
});

void test('shows the charter over the principles without moving the camera or recreating the scene', (t) => {
  const {
    world,
    camera,
    charter,
    timeline,
    timelineEntity,
    principlesConstellation,
    principlesScreen,
    charterScreen,
  } = createScene(t);
  const stars = [...world.query(sim.Principle)];
  assert(charter.has(sim.Hidden));
  timeline.goTo('principles');
  advance(world, principlesScreen.get(sim.ScreenTransition).duration);
  const mapCamera = { ...camera.get(sim.Position) };
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), charterScreen);
  assert.equal(charterScreen.get(sim.Screen).background, 'stars');
  assert.equal(charterScreen.get(sim.Screen).constellationMap, true);
  assert(!charter.has(sim.Hidden));
  assert(stars.every((star) => !star.has(sim.Hidden)));

  const duration = charterScreen.get(sim.ScreenTransition).duration;
  advance(world, duration / 3);
  assert.deepEqual(camera.get(sim.Position), mapCamera);
  timeline.previous();
  assert.deepEqual(camera.get(sim.Position), mapCamera);
  assert(charter.has(sim.Hidden));
  assert.equal(principlesScreen.get(sim.Screen).background, 'stars');
  advance(world, principlesScreen.get(sim.ScreenTransition).duration);

  timeline.next();
  advance(world, duration);
  sim.systems.floatBodies(world);
  const position = camera.get(sim.Position);
  const origin = principlesConstellation.get(sim.Position);
  assert.deepEqual(position, mapCamera);
  assert(stars.every((star) => star.get(sim.Position).z + origin.z < charter.get(sim.Position).z));
  assert(charter.get(sim.Position).z < position.z);
  assert.equal(principlesConstellation.get(sim.ConstellationExpansion).value, 1);
  assert.deepEqual([...world.query(sim.Charter, Not(sim.Hidden))], [charter]);
  assert.deepEqual([...world.query(sim.Principle)], stars);
  timeline.stop();
  assert(charter.has(sim.Hidden));
});

void test('highlights Initiatives in a follow-up step while keeping the charter open', (t) => {
  const { world, camera, charter, timeline, timelineEntity, charterScreen, initiativesScreen } =
    createScene(t);
  timeline.goTo('charter');
  advance(world, charterScreen.get(sim.ScreenTransition).duration);
  const position = { ...camera.get(sim.Position) };
  assert.equal(charterScreen.get(sim.Screen).charterHighlight, '');

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesScreen);
  assert.equal(initiativesScreen.get(sim.Screen).charterHighlight, 'initiatives');
  assert.equal(initiativesScreen.get(sim.Screen).background, 'stars');
  assert(!charter.has(sim.Hidden));
  advance(world, initiativesScreen.get(sim.ScreenTransition).duration / 2);
  assert.deepEqual(camera.get(sim.Position), position);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), charterScreen);
  assert(!charter.has(sim.Hidden));
  advance(world, charterScreen.get(sim.ScreenTransition).duration);
  assert.deepEqual(camera.get(sim.Position), position);

  timeline.next();
  advance(world, initiativesScreen.get(sim.ScreenTransition).duration);
  assert.deepEqual([...world.query(sim.Charter, Not(sim.Hidden))], [charter]);
  assert.deepEqual(camera.get(sim.Position), position);
});

void test('returns from the charter to initiative destinations and retains discoveries on a revisit', (t) => {
  const { world, camera, charter, initiatives, timeline, timelineEntity } = createScene(t);
  assert(initiatives.every((entity) => entity.has(sim.Hidden)));
  timeline.goTo('constellation');
  advance(world, 3);
  assert.deepEqual([...world.query(sim.Initiative, Not(sim.Hidden))], initiatives);
  assert.deepEqual(
    initiatives
      .filter((entity) => !entity.get(sim.Initiative).secret)
      .map((entity) => entity.get(sim.Initiative).title),
    ['Math', 'Glyph', 'Design System', 'React Three Fiber v10']
  );
  const games = initiatives.find((entity) => entity.get(sim.Initiative).secret);
  assert.equal(games.get(sim.Initiative).id, 'games');
  assert(!games.has(sim.Discovered));

  const view = new PerspectiveCamera(camera.get(sim.Camera).fov, 16 / 9, 0.1, 500);
  view.position.copy(camera.get(sim.Position));
  view.updateMatrixWorld();
  for (const entity of initiatives) {
    const point = new Vector3().copy(entity.get(sim.Position)).project(view);
    assert(
      Math.abs(point.x) < 0.85 && Math.abs(point.y) < 0.85,
      'Destinations should fit in the space view'
    );
  }
  games.add(sim.Discovered);
  timeline.goTo('charter-initiatives');
  advance(world, 2);
  assert(initiatives.every((entity) => entity.has(sim.Hidden)));
  assert(!charter.has(sim.Hidden));
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiatives');
  assert(charter.has(sim.Hidden));
  advance(world, timelineEntity.targetFor(sim.ActiveScreen).get(sim.ScreenTransition).duration);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: 120 });
  assert.deepEqual([...world.query(sim.Initiative, Not(sim.Hidden))], initiatives);
  assert(games.has(sim.Discovered));
  timeline.previous();
  assert(!charter.has(sim.Hidden));
  assert(initiatives.every((entity) => entity.has(sim.Hidden)));
  timeline.stop();
  assert(initiatives.every((entity) => entity.isAlive() && entity.has(sim.Hidden)));
});

void test('holds the camera on the charter while it collapses, then pulls away', (t) => {
  const { world, camera, charter, timeline, timelineEntity } = createScene(t);
  timeline.goTo('charter-initiatives');
  advance(world, timelineEntity.targetFor(sim.ActiveScreen).get(sim.ScreenTransition).duration);
  assert.deepEqual(camera.get(sim.Position), { x: 106, y: 8, z: -20 });

  timeline.next();
  const { duration, cameraDelay } = timelineEntity
    .targetFor(sim.ActiveScreen)
    .get(sim.ScreenTransition);
  assert(cameraDelay > 1, 'The charter needs a beat to fall in before the camera leaves');
  assert(charter.has(sim.Hidden));
  advance(world, cameraDelay);
  assert.deepEqual(camera.get(sim.Position), { x: 106, y: 8, z: -20 });
  assert.equal(sim.getRevealProgress(world), 0, 'Initiatives wait for warp speed');
  advance(world, (duration - cameraDelay) / 2);
  assert(camera.get(sim.Position).z > 0 && camera.get(sim.Position).z < 120);
  advance(world, (duration - cameraDelay) / 2);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: 120 });
});

void test('floating portraits stay in separate depth layers up close and in space', async (t) => {
  const { world, timeline } = createScene(t);
  const { profiles } = await server.ssrLoadModule('/src/data/profiles.ts');
  const { createProfile } = sim.actions(world);
  profiles
    .slice(1)
    .forEach((profile, index) => createProfile(profile.login, profile.avatar, index + 1));
  world.set(sim.Bounds, { width: 16, height: 9 });
  timeline.goTo('profiles');
  sim.systems.placeProfiles(world);

  for (const screen of ['profiles', 'constellation']) {
    timeline.goTo(screen);
    advance(world, 3);
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
        assert(
          layers[i - 1].max.z < layers[i].min.z,
          `Portraits intersect on ${screen} at ${elapsed}s`
        );
      }
    }
  }
});

void test('entering applies the destination screen data in either direction', (t) => {
  const { world, camera, timeline, packageSizes, letters } = createScene(t);
  packageSizes.set(sim.Screen, { packagesVisible: false });
  letters.set(sim.Screen, { packagesVisible: true });
  packageSizes.set(sim.ScreenTransition, { duration: 0.8, cameraX: -1, cameraY: 2, cameraZ: 13 });
  letters.set(sim.ScreenTransition, { duration: 0.2, cameraX: 1, cameraY: -2, cameraZ: 8 });
  timeline.goTo('letters');
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
  const { world, letter, title, timeline, timelineEntity, titleScreen } = createScene(t);
  const screenCount = world.query(sim.Screen).length;
  timeline.goTo('constellation');
  timeline.stop();
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), undefined);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 1);
  assert.equal(letter.has(sim.Hidden), false);
  assert(title.has(sim.Hidden));
  assert.equal(timeline.start(), timelineEntity);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  timeline.goTo('letters');
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);

  timeline.stop();
  assert.equal(world.query(sim.Profile, Not(sim.Hidden)).length, 0);
  timelineEntity.destroy();
  assert.equal(world.query(sim.Screen).length, 0);
  const restarted = timeline.start();
  assert.equal(world.query(sim.Screen).length, screenCount);
  assert.equal(restarted.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'title');
});
