import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld, Not } from 'koota';
import { Box3, Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { createServer } from 'vite';

let server;
let sim;
let contributors;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
  });
  sim = await server.ssrLoadModule('/src/sim/index.ts');
  contributors = (await server.ssrLoadModule('/src/data/profiles.ts')).profiles;
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
  const timeline = sim.timelineActions(world);

  t.after(() => {
    timeline.stop();
    world.destroy();
  });

  const timelineEntity = timeline.start();
  const titleScreen = timelineEntity.targetFor(sim.FirstScreen);
  const launch = titleScreen.targetFor(sim.NextScreen);
  const intro = launch.targetFor(sim.NextScreen);
  const comparison = intro.targetFor(sim.NextScreen);
  const threeFeatures = comparison.targetFor(sim.NextScreen);
  const robot = threeFeatures.targetFor(sim.NextScreen);
  const warp = robot.targetFor(sim.NextScreen);
  const packageOverview = warp.targetFor(sim.NextScreen);
  const packageMaintainers = packageOverview.targetFor(sim.NextScreen);
  const packageSizes = packageMaintainers.targetFor(sim.NextScreen);
  const letters = packageSizes.targetFor(sim.NextScreen);
  const contributors = letters.targetFor(sim.NextScreen);
  const greeting = contributors.targetFor(sim.NextScreen);
  const logos = greeting.targetFor(sim.NextScreen);
  const name = logos.targetFor(sim.NextScreen);
  const reserved = name.targetFor(sim.NextScreen);
  const work = reserved.targetFor(sim.NextScreen);
  const paulCommunity = work.targetFor(sim.NextScreen);
  const communityReel = paulCommunity.targetFor(sim.NextScreen);
  const communityNext = communityReel.targetFor(sim.NextScreen);
  const communityGrowth = communityNext.targetFor(sim.NextScreen);
  const communityRobot = communityGrowth.targetFor(sim.NextScreen);
  const maintainers = communityRobot.targetFor(sim.NextScreen);
  const maintainerTeam = maintainers.targetFor(sim.NextScreen);
  const principlesScreen = maintainerTeam.targetFor(sim.NextScreen);
  const tastefulScreen = principlesScreen.targetFor(sim.NextScreen);
  const logoScreen = tastefulScreen.targetFor(sim.NextScreen);
  const charterScreen = logoScreen.targetFor(sim.NextScreen);
  const initiativesScreen = charterScreen.targetFor(sim.NextScreen);
  const initiativesFocusScreen = initiativesScreen.targetFor(sim.NextScreen);
  const storyScreen = initiativesFocusScreen.targetFor(sim.NextScreen);
  const connectionsScreen = storyScreen.targetFor(sim.NextScreen);
  const announcementScreen = connectionsScreen.targetFor(sim.NextScreen);
  const constellation = announcementScreen.targetFor(sim.NextScreen);
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
    launch,
    intro,
    comparison,
    threeFeatures,
    robot,
    warp,
    packageOverview,
    packageMaintainers,
    packageSizes,
    letters,
    contributors,
    greeting,
    reserved,
    logos,
    name,
    work,
    paulCommunity,
    communityReel,
    communityNext,
    communityGrowth,
    communityRobot,
    maintainers,
    maintainerTeam,
    constellation,
    principlesScreen,
    tastefulScreen,
    logoScreen,
    charterScreen,
    initiativesScreen,
    initiativesFocusScreen,
    storyScreen,
    connectionsScreen,
    announcementScreen,
  };
}

function advance(world, seconds, fps = 60) {
  const start = world.get(sim.Time).elapsed;
  for (let frame = 0; frame < seconds * fps; frame++) {
    const elapsed = start + Math.min((frame + 1) / fps, seconds);
    sim.systems.updateTime(world, elapsed - world.get(sim.Time).elapsed, elapsed);
    sim.advanceTimeline(world);
    sim.systems.moveCamera(world);
    sim.systems.resizePackages(world);
  }
}

void test('holds at warp until advancing to counts, code, Three features, and the robot', (t) => {
  const {
    world,
    camera,
    title,
    titleScreen,
    letter,
    packages,
    timeline,
    timelineEntity,
    launch,
    intro,
    comparison,
    threeFeatures,
    robot,
    warp,
    packageOverview,
    packageMaintainers,
    packageSizes,
    letters,
  } = createScene(t);
  const featured = [
    sim.actions(world).createPackage('@react-three/fiber', 5_129_998, 1, 1.1, 0.86),
    sim.actions(world).createPackage('three', 15_193_062, 2, 1.2, 1.48),
  ];
  for (const entity of featured) entity.add(sim.Hidden);
  const allPackages = [...packages, ...featured];
  const pmndrsPackages = [...packages, featured[0]];
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  assert.equal(title.get(sim.Title).text.replaceAll('\n', ' '), 'Beyond React Three Fiber');
  assert.equal(titleScreen.get(sim.Screen).background, 'solid');
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), launch);
  assert.equal(launch.get(sim.Screen).id, 'warp-launch');
  assert(!title.has(sim.Hidden));
  advance(world, 8);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), launch);
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));
  assert.equal(launch.get(sim.Screen).packageDownloadsVisible, false);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), intro);
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert.equal(intro.get(sim.Screen).background, titleScreen.get(sim.Screen).background);
  assert.equal(intro.get(sim.Screen).packageDownloadsVisible, true);
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
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), robot);
  assert.equal(robot.get(sim.Screen).robotVisible, true);
  assert.equal(robot.get(sim.Screen).packageFeaturesVisible, true);
  assert(!title.has(sim.Hidden));
  assert(letter.has(sim.Hidden));
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  advance(world, robot.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), threeFeatures);
  assert.equal(threeFeatures.get(sim.Screen).robotVisible, false);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
  timeline.next();
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), warp);
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));
  assert(!title.has(sim.Hidden));
  advance(world, warp.get(sim.ScreenTransition).duration + 1 / 60);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageOverview);
  assert(title.has(sim.Hidden));
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(pmndrsPackages));
  advance(world, packageOverview.get(sim.ScreenTransition).duration);
  assert(
    allPackages.every(
      (entity) => entity.get(sim.Size).radius === entity.get(sim.PackageSizing).compressed
    )
  );
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageMaintainers);
  assert.equal(packageMaintainers.get(sim.Screen).id, 'package-maintainers');
  assert.equal(packageMaintainers.get(sim.Screen).packageMaintainersVisible, true);
  assert.equal(packageMaintainers.get(sim.Screen).profilesVisible, false);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(pmndrsPackages));
  advance(world, packageMaintainers.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  assert.equal(packages[0].get(sim.Size).radius, packages[0].get(sim.PackageSizing).compressed);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageOverview);
  assert.equal(packageOverview.get(sim.Screen).packageMaintainersVisible, false);
  timeline.next();
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageSizes);
  assert.equal(packageSizes.get(sim.Screen).packageMaintainersVisible, false);
  const beforeGrowth = packages[0].get(sim.Size).radius;
  advance(world, packageSizes.get(sim.ScreenTransition).duration / 2);
  assert(packages[0].get(sim.Size).radius > beforeGrowth);
  assert(packages[0].get(sim.Size).radius < packages[0].get(sim.PackageSizing).proportional);
  advance(world, packageSizes.get(sim.ScreenTransition).duration / 2);
  assert(
    allPackages.every(
      (entity) => entity.get(sim.Size).radius === entity.get(sim.PackageSizing).proportional
    )
  );
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(pmndrsPackages));
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), letters);
  assert.equal(world.query(sim.Package, Not(sim.Hidden)).length, 0);
  assert.equal(letter.has(sim.Hidden), false);
  assert.equal(camera.get(sim.Position).z, 12);
  advance(world, letters.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 8);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageSizes);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(pmndrsPackages));
  assert.equal(camera.get(sim.Position).z, 8);
  advance(world, packageSizes.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, 12);
  assert.deepEqual([...world.query(sim.Letter)], [letter]);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageMaintainers);
  assert.equal(packageMaintainers.get(sim.Screen).packageMaintainersVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageOverview);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(pmndrsPackages));
  advance(world, packageOverview.get(sim.ScreenTransition).duration);
  assert(
    allPackages.every(
      (entity) => entity.get(sim.Size).radius === entity.get(sim.PackageSizing).compressed
    )
  );
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), robot);
  assert.deepEqual(new Set(world.query(sim.Package, Not(sim.Hidden))), new Set(featured));
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
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), launch);
  assert(allPackages.every((entity) => entity.has(sim.Hidden)));
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  assert.deepEqual([...world.query(sim.Title, Not(sim.Hidden))], [title]);
  assert(allPackages.every((entity) => entity.isAlive() && entity.has(sim.Hidden)));
});

void test('warp hands off automatically and cancels when navigating back', (t) => {
  const { world, timeline, timelineEntity, robot, warp, packageOverview, packages } = createScene(t);
  timeline.goTo('robot');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), warp);
  assert(warp.get(sim.Screen).warpVisible);
  assert(packages.every((entity) => entity.has(sim.Hidden)));
  advance(world, warp.get(sim.ScreenTransition).duration - 0.1);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), warp);
  advance(world, 0.2);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), packageOverview);
  assert.equal(packageOverview.get(sim.Screen).packageEntry, 'scale');
  assert(
    packageOverview.get(sim.Screen).packageDelay >= 0.5,
    'Packages wait a beat after the portal'
  );
  assert(packages.every((entity) => !entity.has(sim.Hidden)));

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), robot);
  timeline.next();
  advance(world, 0.5);
  timeline.previous();
  advance(world, 4);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), robot);
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
    greeting,
    reserved,
    logos,
    name,
    work,
    paulCommunity,
    communityReel,
    communityNext,
    communityGrowth,
    communityRobot,
    maintainers,
    maintainerTeam,
    constellation,
    principlesScreen,
    tastefulScreen,
    logoScreen,
    charterScreen,
    initiativesScreen,
  } = createScene(t);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), titleScreen);
  timeline.goTo('letters');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), contributors);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), greeting);
  for (const page of [logos, name, reserved]) {
    timeline.next();
    assert.equal(timelineEntity.targetFor(sim.ActiveScreen), page);
  }
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityReel);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityNext);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityGrowth);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityRobot);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainers);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainerTeam);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), principlesScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), tastefulScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), logoScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), charterScreen);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesScreen);
  timeline.next();
  assert.equal(
    timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id,
    'charter-initiatives-focus'
  );
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiative-story');
  timeline.next();
  assert.equal(
    timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id,
    'initiative-connections'
  );
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'charter-announcement');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), constellation);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'portal-fall');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiatives');
  assert.deepEqual(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).initiativeChips, []);
  timeline.next();
  const r3fFeatures = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(r3fFeatures.get(sim.Screen).id, 'initiative-r3f-features');
  assert.equal(r3fFeatures.get(sim.Screen).initiative, 'r3f-v10');
  assert.equal(r3fFeatures.get(sim.Screen).initiativesVisible, true);
  assert.deepEqual(r3fFeatures.get(sim.Screen).initiativeChips, [
    'Declarative WebGPU',
    'New scheduler',
    'TSL hooks',
    'Drei reborn',
  ]);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'initiatives');
  assert.deepEqual(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).initiativeChips, []);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), r3fFeatures);
  timeline.next();
  const glyph = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(glyph.get(sim.Screen).id, 'initiative-glyph');
  assert.equal(glyph.get(sim.Screen).initiative, 'glyph');
  assert.equal(glyph.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).initiative, 'r3f-v10');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), glyph);
  timeline.next();
  const designSystem = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(designSystem.get(sim.Screen).id, 'initiative-design-system');
  assert.equal(designSystem.get(sim.Screen).initiative, 'design-system');
  assert.equal(designSystem.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), glyph);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), designSystem);
  timeline.next();
  const math = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(math.get(sim.Screen).id, 'initiative-math');
  assert.equal(math.get(sim.Screen).initiative, 'math');
  assert.equal(math.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), designSystem);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), math);
  timeline.next();
  const benchmark = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(benchmark.get(sim.Screen).id, 'math-benchmark');
  assert.equal(benchmark.get(sim.Screen).benchmarkVisible, true);
  assert.equal(benchmark.get(sim.Screen).initiative, 'math');
  assert.equal(benchmark.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), math);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), benchmark);
  timeline.next();
  const bridgeBenchmark = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(bridgeBenchmark.get(sim.Screen).id, 'math-three-benchmark');
  assert.equal(bridgeBenchmark.get(sim.Screen).benchmarkVisible, true);
  assert.equal(bridgeBenchmark.get(sim.Screen).benchmarkVariant, 'three');
  assert.equal(bridgeBenchmark.get(sim.Screen).initiative, 'math');
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), benchmark);
  assert.equal(benchmark.get(sim.Screen).benchmarkVariant, 'spider');
  timeline.next();
  timeline.next();
  const experimental = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(experimental.get(sim.Screen).id, 'initiative-experimental');
  assert.equal(experimental.get(sim.Screen).initiative, 'experimental');
  assert.equal(experimental.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), bridgeBenchmark);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), experimental);
  timeline.next();
  const games = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(games.get(sim.Screen).id, 'initiative-games');
  assert.equal(games.get(sim.Screen).initiative, 'games');
  assert.equal(games.get(sim.Screen).initiativesVisible, true);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), experimental);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), games);
  assert.deepEqual(games.get(sim.Screen).initiativeChips, []);
  timeline.next();
  const gamesFeatures = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(gamesFeatures.get(sim.Screen).id, 'initiative-games-features');
  assert.equal(gamesFeatures.get(sim.Screen).initiative, 'games');
  assert.equal(gamesFeatures.get(sim.Screen).initiativesVisible, true);
  assert.deepEqual(gamesFeatures.get(sim.Screen).initiativeChips, [
    'crashcat',
    'navcat',
    'gpucat',
    'more!',
  ]);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), games);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), gamesFeatures);
  timeline.next();
  const closing = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(closing.get(sim.Screen).id, 'closing');
  assert.equal(closing.get(sim.Screen).closingVisible, true);
  assert.equal(closing.get(sim.Screen).background, 'blue');
  assert.equal(world.query(sim.Initiative, Not(sim.Hidden)).length, 0);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), closing);
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
      '@use-gesture/react',
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
  sim.systems.placeProfiles(world, sim.systems.createProfileLayout(world.query(sim.Profile).length));
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

void test('keeps PMNDRS and profiles visible for scale during the ejection', (t) => {
  const { world, camera, letter, packages, profiles, timeline, announcementScreen, constellation } =
    createScene(t);
  const member = sim.actions(world).createProfile('DennisSmolek', './profiles/DennisSmolek.jpg', 1);
  timeline.goTo('charter-announcement');
  advance(world, announcementScreen.get(sim.ScreenTransition).duration);
  timeline.next();
  assert([letter, ...profiles].every((entity) => !entity.has(sim.Hidden)));
  assert(packages.every((entity) => entity.has(sim.Hidden)));
  assert.equal(constellation.get(sim.Screen).backgroundVisible, true);
  assert.equal(constellation.get(sim.Screen).background, 'stars');
  assert.equal(constellation.get(sim.Screen).initiativesVisible, false);
  const { duration, cameraDelay } = constellation.get(sim.ScreenTransition);
  advance(world, cameraDelay + (duration - cameraDelay) / 2);
  const midway = camera.get(sim.Position).z;
  assert(midway > 12 && midway < 120);

  timeline.previous();
  assert.equal(camera.get(sim.Position).z, midway);
  assert.equal(letter.has(sim.Hidden), false);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], [member]);
  assert.equal(announcementScreen.get(sim.Screen).backgroundVisible, true);
  assert.equal(announcementScreen.get(sim.Screen).background, 'pastel');
  advance(world, announcementScreen.get(sim.ScreenTransition).duration);
  assert.equal(camera.get(sim.Position).z, -5);

  timeline.next();
  advance(world, constellation.get(sim.ScreenTransition).duration + 0.2);
  assert(camera.get(sim.Position).z >= 120 && camera.get(sim.Position).z < 121);
  assert([letter, ...profiles].every((entity) => entity.isAlive() && !entity.has(sim.Hidden)));
  assert(profiles.every((entity) => camera.get(sim.Camera).far > 120 - entity.get(sim.Anchor).z));
});

void test('profiles resume their floating motion after leaving the sphere preview', (t) => {
  const { world, camera, letter, profiles, timeline } = createScene(t);
  timeline.goTo('package-sizes');
  world.set(sim.Bounds, { width: 16, height: 9 });
  for (const entity of [letter, ...profiles]) entity.set(sim.Float, { phase: 1, speed: 0.4 });
  sim.systems.updateAnchors(world);
  sim.systems.placeProfiles(world, sim.systems.createProfileLayout(world.query(sim.Profile).length));

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

  assert(motionOnScreen(letter) > 0);
  timeline.goTo('profiles');
  advance(world, 3);
  const profileMotion = motionOnScreen(profiles[0]);
  timeline.goTo('initiatives');
  advance(world, 1);
  assert.equal(motionOnScreen(letter), 0);
  assert.equal(motionOnScreen(profiles[0]), 0);

  timeline.goTo('profiles');
  advance(world, 3);
  assert(Math.abs(motionOnScreen(profiles[0]) - profileMotion) < 1e-9);
});

void test('holds the connected team beneath the principles curtain and delays the text reveal', (t) => {
  const { world, camera, letter, timeline, timelineEntity, maintainerTeam, principlesScreen } =
    createScene(t);
  for (const [index, login] of maintainerTeam.get(sim.Screen).surroundingProfiles.entries()) {
    if (login !== 'drcmda')
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1);
  }
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
    sim.systems.wanderProfiles(world);
  };
  timeline.goTo('maintainer-team');
  advance(world, 10);
  sample();
  const portraits = [...world.query(sim.Profile, Not(sim.Hidden))];
  const positions = portraits.map((profile) => ({ ...profile.get(sim.Position) }));
  const teamCamera = { ...camera.get(sim.Position) };
  assert(portraits.length > 1);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), principlesScreen);
  assert.equal(principlesScreen.get(sim.Screen).principlesVisible, true);
  assert.equal(principlesScreen.get(sim.Screen).background, 'pastel');
  assert(!letter.has(sim.Hidden));
  // The team remains visible beneath the entering curtain
  assert(principlesScreen.get(sim.Screen).profilesVisible);
  assert(principlesScreen.get(sim.Screen).communityRobotVisible);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], portraits);
  sample();
  assert.deepEqual(
    portraits.map((profile) => profile.get(sim.Position)),
    positions
  );

  // The camera holds still: the reveal is the only thing that moves
  const destination = principlesScreen.get(sim.ScreenTransition);
  advance(world, destination.revealDelay);
  assert.deepEqual(camera.get(sim.Position), teamCamera);
  assert(sim.getRevealTime(world) < 1e-12);
  advance(world, (destination.duration - destination.revealDelay) / 2);
  const halfway = sim.getRevealTime(world);
  assert(halfway > 0.4 && halfway < 0.6);
  assert.deepEqual(camera.get(sim.Position), teamCamera);
  advance(world, destination.duration);
  assert.equal(sim.getRevealTime(world), 1);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainerTeam);
  advance(world, 8);
  sample();
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], portraits);
});

void test('adds Tasteful in a separate beat while holding the principles scene, and reverses', (t) => {
  const { world, camera, timeline, timelineEntity, principlesScreen, tastefulScreen } =
    createScene(t);
  timeline.goTo('principles');
  advance(world, 4);
  const position = { ...camera.get(sim.Position) };
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), tastefulScreen);
  assert.equal(tastefulScreen.get(sim.Screen).id, 'principles-tasteful');
  const { id: originalId, ...original } = principlesScreen.get(sim.Screen);
  const { id: nextId, ...next } = tastefulScreen.get(sim.Screen);
  assert.notEqual(originalId, nextId);
  assert.deepEqual(next, original);
  assert(tastefulScreen.get(sim.ScreenTransition).revealDelay > 0);
  advance(world, 4);
  assert.deepEqual(camera.get(sim.Position), position);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), tastefulScreen);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), principlesScreen);
  advance(world, 4);
  assert.deepEqual(camera.get(sim.Position), position);
});

void test('introduces Poimandres after the profiles and waits before the story', (t) => {
  const { world, camera, charter, profiles, timeline, timelineEntity, greeting, contributors } =
    createScene(t);
  timeline.goTo('profiles');
  advance(world, contributors.get(sim.ScreenTransition).duration);
  const position = { ...camera.get(sim.Position) };
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), greeting);
  assert.equal(greeting.get(sim.Screen).id, 'hello');
  assert.equal(greeting.get(sim.Screen).greetingVisible, true);
  assert.equal(greeting.get(sim.Screen).background, 'pastel');
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert(charter.has(sim.Hidden));
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), greeting);
  assert.deepEqual(camera.get(sim.Position), position);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), contributors);
  assert.equal(contributors.get(sim.Screen).greetingVisible, false);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), greeting);
});

void test('stacks three history pages between hello and work and peels them back', (t) => {
  const {
    world,
    camera,
    timeline,
    timelineEntity,
    greeting,
    reserved,
    logos,
    name,
    work,
    paulCommunity,
  } = createScene(t);
  timeline.goTo('hello');
  advance(world, 3);
  const position = { ...camera.get(sim.Position) };
  assert.equal(logos.get(sim.Screen).id, 'history-logos');
  assert.equal(name.get(sim.Screen).id, 'history-name');
  assert.equal(reserved.get(sim.Screen).id, 'history-reserved');
  for (const [index, page] of [logos, name, reserved].entries()) {
    timeline.next();
    assert.equal(timelineEntity.targetFor(sim.ActiveScreen), page);
    assert.equal(page.get(sim.Screen).historyPages, index + 1);
    advance(world, 10);
    assert.equal(timelineEntity.targetFor(sim.ActiveScreen), page);
    assert.deepEqual(camera.get(sim.Position), position);
  }
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  assert.equal(work.get(sim.Screen).id, 'work');
  assert.equal(work.get(sim.Screen).greetingVisible, true);
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  assert.deepEqual(camera.get(sim.Position), position);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  for (const page of [reserved, name, logos]) {
    timeline.previous();
    assert.equal(timelineEntity.targetFor(sim.ActiveScreen), page);
  }
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), greeting);
});

void test('starts focusing the group immediately and restores the portraits on return', (t) => {
  const { world, camera, charter, profiles, timeline, timelineEntity, paulCommunity, work } =
    createScene(t);
  const other = sim.actions(world).createProfile('dai-shi', './profiles/dai-shi.png', 1);
  const portrait = profiles[0];
  portrait.set(sim.Anchor, { x: 2, y: -1 });
  const radius = portrait.get(sim.Size).radius;
  timeline.goTo('work');
  advance(world, 2.3);
  sim.systems.floatBodies(world);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
  assert.equal(paulCommunity.get(sim.Screen).greetingVisible, false);
  // Paul joins the ring instead of holding the middle
  assert.equal(paulCommunity.get(sim.Screen).focusedProfile, '');
  assert(paulCommunity.get(sim.Screen).surroundingProfiles.includes('drcmda'));
  assert(charter.has(sim.Hidden));
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], [portrait, other]);
  assert(other.isAlive());

  advance(world, 0.1);
  sim.systems.floatBodies(world);
  const floating = { ...portrait.get(sim.Position) };
  sim.systems.focusProfiles(world);
  assert(sim.getRevealProgress(world) > 0);
  assert(Math.abs(portrait.get(sim.Position).x) < Math.abs(floating.x));

  advance(world, 2.5);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  // The first slot sits at the top of the ring, leaving the middle empty
  const settled = { ...portrait.get(sim.Position) };
  assert(Math.abs(settled.x - camera.get(sim.Position).x) < 0.5);
  assert(settled.y > camera.get(sim.Position).y + 0.5);
  assert.equal(portrait.get(sim.Size).radius, radius);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], [portrait, other]);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  assert.deepEqual(portrait.get(sim.Position), settled);
  advance(world, 2.3);
  sim.systems.floatBodies(world);
  const restored = { ...portrait.get(sim.Position) };
  sim.systems.focusProfiles(world);
  assert.deepEqual(portrait.get(sim.Position), restored);
  assert.equal(portrait.get(sim.ProfileFocus).value, 0);
});

void test('goes straight from the work question to six hovering profiles and back', (t) => {
  const { world, camera, profiles, timeline, timelineEntity, work, paulCommunity } = createScene(t);
  const companions = paulCommunity
    .get(sim.Screen)
    .surroundingProfiles.filter((login) => login !== 'drcmda')
    .map((login, index) =>
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1)
    );
  const unrelated = sim.actions(world).createProfile('other', './profiles/other.png', 6);
  timeline.goTo('work');
  advance(world, work.get(sim.ScreenTransition).duration);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
  assert.deepEqual(
    new Set(world.query(sim.Profile, Not(sim.Hidden))),
    new Set([...profiles, ...companions])
  );
  assert(unrelated.has(sim.Hidden));
  assert.equal(paulCommunity.get(sim.Screen).greetingVisible, false);
  advance(world, paulCommunity.get(sim.ScreenTransition).duration);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  // All six ring the camera's center with nobody in the middle
  const center = camera.get(sim.Position);
  const ring = [...profiles, ...companions];
  const positions = ring.map((profile) => ({ ...profile.get(sim.Position) }));
  assert(positions.some((position) => position.x < center.x));
  assert(positions.some((position) => position.x > center.x));
  assert(positions.some((position) => position.y < center.y));
  assert(positions.some((position) => position.y > center.y));
  assert(positions.every((position) => Math.hypot(position.x - center.x, position.y - center.y) > 1));
  advance(world, 1);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  assert(ring.every((profile, index) => profile.get(sim.Position).y !== positions[index].y));
  const apparentRadii = ring.map(
    (profile) =>
      (profile.get(sim.Size).radius * profile.get(sim.ProfileFocus).scale) /
      (camera.get(sim.Position).z - profile.get(sim.Position).z)
  );
  assert(Math.max(...apparentRadii) - Math.min(...apparentRadii) < 1e-9);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), work);
  assert.deepEqual(
    new Set(world.query(sim.Profile, Not(sim.Hidden))),
    new Set([...profiles, ...companions, unrelated])
  );
  advance(world, 3);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  assert(companions.every((profile) => profile.get(sim.ProfileFocus).scale === 1));
});

void test('gathers the profile ring first, then opens the showreel wall behind it', (t) => {
  const {
    world,
    camera,
    profiles,
    timeline,
    timelineEntity,
    work,
    paulCommunity,
    communityReel,
    communityNext,
  } = createScene(t);
  const companions = paulCommunity
    .get(sim.Screen)
    .surroundingProfiles.filter((login) => login !== 'drcmda')
    .map((login, index) =>
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1)
    );
  const ring = [...profiles, ...companions];
  timeline.goTo('work');
  advance(world, work.get(sim.ScreenTransition).duration);
  const position = { ...camera.get(sim.Position) };

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
  // The six gather into a ring on their own, without any video yet
  assert.equal(paulCommunity.get(sim.Screen).showreelVisible, false);
  assert.equal(work.get(sim.Screen).showreelVisible, false);
  advance(world, paulCommunity.get(sim.ScreenTransition).duration);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  assert.deepEqual(camera.get(sim.Position), position);
  assert.deepEqual(new Set(world.query(sim.Profile, Not(sim.Hidden))), new Set(ring));
  assert(ring.every((profile) => profile.get(sim.ProfileFocus).value === 1));

  // The reel begins on the next beat while the ring holds its place
  assert.equal(paulCommunity.get(sim.Screen).autoAdvance, false);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityReel);
  const reel = communityReel.get(sim.Screen);
  assert(reel.showreelVisible);
  assert.equal(reel.showreelFocus, -1);
  assert.deepEqual(reel.surroundingProfiles, paulCommunity.get(sim.Screen).surroundingProfiles);
  const slots = ring.map((profile) => profile.get(sim.ProfileFocus).slot);
  advance(world, communityReel.get(sim.ScreenTransition).duration);
  sim.systems.floatBodies(world);
  sim.systems.focusProfiles(world);
  assert.deepEqual(camera.get(sim.Position), position);
  assert.deepEqual(
    ring.map((profile) => profile.get(sim.ProfileFocus).slot),
    slots
  );
  assert(ring.every((profile) => profile.get(sim.ProfileFocus).value === 1));

  // The wall loops until the talk moves on, and the reel carries into the next screen
  assert.equal(communityReel.get(sim.Screen).autoAdvance, false);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityNext);
  assert(communityNext.get(sim.Screen).showreelVisible);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityReel);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), paulCommunity);
});

void test('hands the front row to the wider group while the first six recede', (t) => {
  const {
    world,
    camera,
    timeline,
    timelineEntity,
    profiles,
    paulCommunity,
    communityReel,
    communityNext,
  } = createScene(t);
  const receding = [
    ...profiles,
    ...paulCommunity
      .get(sim.Screen)
      .surroundingProfiles.filter((login) => login !== 'drcmda')
      .map((login, index) =>
        sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1)
      ),
  ];
  const arriving = communityNext
    .get(sim.Screen)
    .surroundingProfiles.map((login, index) =>
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 6)
    );
  // How large a portrait reads on screen, independent of the depth it floats at
  const apparent = (profile) =>
    (profile.get(sim.Size).radius * profile.get(sim.ProfileFocus).scale) /
    (camera.get(sim.Position).z - profile.get(sim.Position).z);

  timeline.goTo('community-reel');
  advance(world, communityReel.get(sim.ScreenTransition).duration);
  sim.systems.focusProfiles(world);
  const front = receding.map(apparent);
  assert(arriving.every((profile) => profile.has(sim.Hidden)));

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityNext);
  // The reel closes in on the bottom right tile before cutting to the next clip
  assert.equal(communityNext.get(sim.Screen).showreelFocus, 15);
  assert(communityNext.get(sim.Screen).showreelVisible);
  advance(world, communityNext.get(sim.ScreenTransition).duration);
  sim.systems.focusProfiles(world);

  // The wider group omits the four portraits reserved for other scenes
  assert(arriving.length > receding.length);
  assert.deepEqual(
    new Set([...receding, ...arriving].map((profile) => profile.get(sim.Profile).login)),
    new Set(
      contributors
        .map((profile) => profile.login)
        .filter(
          (login) => !['kvvasuu', 'thejustinwalsh', 'DennisSmolek', 'castavridis'].includes(login)
        )
    )
  );

  // The newcomers own the front row while the first six shrink and drop behind them
  assert(arriving.every((profile) => !profile.has(sim.Hidden)));
  assert(arriving.every((profile) => profile.get(sim.ProfileFocus).recede === 0));
  assert(receding.every((profile) => profile.get(sim.ProfileFocus).recede === 1));
  assert(receding.every((profile, index) => apparent(profile) < front[index]));
  const behind = Math.max(...receding.map(apparent));
  assert(arriving.every((profile) => apparent(profile) > behind));
  // Paul recedes in his ring with the others
  assert.equal(profiles[0].get(sim.ProfileFocus).recede, 1);
  assert.equal(profiles[0].get(sim.ProfileFocus).slot, 0);

  // Going back restores the first six to the front row and sends the newcomers away
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityReel);
  advance(world, communityReel.get(sim.ScreenTransition).duration);
  sim.systems.focusProfiles(world);
  assert(receding.every((profile) => profile.get(sim.ProfileFocus).recede === 0));
  assert.deepEqual(receding.map(apparent), front);
  assert(arriving.every((profile) => profile.has(sim.Hidden)));
});

void test('grows R3F among the full group before revealing the robot behind it', (t) => {
  const { world, camera, timeline, timelineEntity, communityNext, communityGrowth, communityRobot } =
    createScene(t);
  const fiber = sim.actions(world).createPackage('@react-three/fiber', 5_129_998, 4, 1.1, 0.86);
  const previous = communityNext.get(sim.Screen);
  for (const [index, login] of [
    ...previous.surroundingProfiles,
    ...previous.recedingProfiles,
  ].entries()) {
    if (login !== 'drcmda')
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1);
  }
  world.set(sim.Bounds, { width: 16, height: 9 });
  timeline.goTo('community-next');
  advance(world, communityNext.get(sim.ScreenTransition).duration);
  const portraits = [...world.query(sim.Profile, Not(sim.Hidden))];
  const position = { ...camera.get(sim.Position) };
  assert(fiber.has(sim.Hidden));

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityGrowth);
  const growth = communityGrowth.get(sim.Screen);
  assert(growth.packageDownloadsVisible);
  assert.equal(growth.communityRobotVisible, false);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], [fiber]);
  advance(world, 6);
  sim.systems.placePackages(world);
  const anchor = { ...fiber.get(sim.Anchor) };
  assert(anchor.z + fiber.get(sim.Size).radius < position.z);
  assert.equal(anchor.x, position.x);
  assert.equal(anchor.y, position.y);
  sim.systems.floatBodies(world);
  assert.deepEqual(fiber.get(sim.Position), anchor);
  advance(world, 2);
  sim.systems.floatBodies(world);
  assert.deepEqual(fiber.get(sim.Position), anchor);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityGrowth);
  assert.deepEqual(camera.get(sim.Position), position);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], portraits);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityRobot);
  const reveal = communityRobot.get(sim.Screen);
  assert(reveal.communityRobotVisible);
  assert.equal(reveal.robotVisible, false);
  assert(reveal.showreelVisible);
  assert(reveal.packageDownloadsVisible);
  assert.equal(reveal.packageLayout, growth.packageLayout);
  assert.equal(reveal.showreelFocus, previous.showreelFocus);
  assert.deepEqual(reveal.surroundingProfiles, previous.surroundingProfiles);
  assert.deepEqual(reveal.recedingProfiles, previous.recedingProfiles);
  advance(world, 6);
  sim.systems.placePackages(world);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityRobot);
  assert.deepEqual(camera.get(sim.Position), position);
  assert.deepEqual(fiber.get(sim.Anchor), anchor);
  sim.systems.floatBodies(world);
  assert.deepEqual(fiber.get(sim.Position), anchor);
  assert.deepEqual([...world.query(sim.Package, Not(sim.Hidden))], [fiber]);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], portraits);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityGrowth);
  assert(!fiber.has(sim.Hidden));
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityNext);
  assert(fiber.has(sim.Hidden));
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], portraits);
  timeline.goTo('community-robot');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'maintainers');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'maintainer-team');
  assert(fiber.has(sim.Hidden));
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'principles');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'principles-tasteful');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'principles-logo');
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'charter');
  assert(fiber.has(sim.Hidden));

  timeline.goTo('package-sizes');
  advance(world, 2);
  sim.systems.placePackages(world);
  assert(!fiber.has(sim.Hidden));
  assert(fiber.get(sim.Anchor).z > 0);
  sim.systems.floatBodies(world);
  const overviewPosition = { ...fiber.get(sim.Position) };
  advance(world, 2);
  sim.systems.floatBodies(world);
  assert.notDeepEqual(fiber.get(sim.Position), overviewPosition);
});

void test('holds the growth screen before profiles slowly depart and continue through the robot', (t) => {
  const { world, camera, timeline, timelineEntity, communityGrowth } = createScene(t);
  const group = communityGrowth.get(sim.Screen);
  for (const [index, login] of [...group.recedingProfiles, ...group.surroundingProfiles].entries()) {
    if (login !== 'drcmda') sim.actions(world).createProfile(login, `./profiles/${login}.png`, index);
  }
  const portraits = [...world.query(sim.Profile)];
  for (const portrait of portraits) portrait.set(sim.Float, { amplitude: 0 });
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
    sim.systems.wanderProfiles(world);
    return portraits.map((portrait) => ({ ...portrait.get(sim.Position) }));
  };
  timeline.goTo('community-next');
  advance(world, 4);
  sample();
  timeline.goTo('community-growth');
  advance(world, 1);
  const ring = sample();
  advance(world, 3);
  assert.deepEqual(sample(), ring);
  assert(portraits.every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 1));

  advance(world, 2);
  sample();
  assert(
    portraits.every((profile) => {
      const opacity = profile.get(sim.ProfileFocus).wanderOpacity;
      return opacity > 0.2 && opacity < 1;
    })
  );
  advance(world, 1.8);
  const early = sample();
  const earlyOpacity = portraits.map((profile) => profile.get(sim.ProfileFocus).wanderOpacity);
  assert(earlyOpacity.every((opacity) => opacity > 0 && opacity < 1));
  assert(
    early.every(
      (position, index) => Math.hypot(position.x - ring[index].x, position.y - ring[index].y) > 0
    )
  );
  const offscreen = (position, index) => {
    const halfHeight = (camera.get(sim.Position).z - position.z) * Math.tan(Math.PI / 8);
    const radius =
      portraits[index].get(sim.Size).radius * portraits[index].get(sim.ProfileFocus).scale;
    return (
      Math.abs(position.x) - radius > (halfHeight * 16) / 9 ||
      Math.abs(position.y) - radius > halfHeight
    );
  };
  assert(early.every((position, index) => !offscreen(position, index)));
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityGrowth);
  const departureStartedAt = timelineEntity.get(sim.Timeline).departureStartedAt;
  timeline.next();
  assert.equal(timelineEntity.get(sim.Timeline).departureStartedAt, departureStartedAt);
  assert.deepEqual(sample(), early);
  assert.deepEqual(
    portraits.map((profile) => profile.get(sim.ProfileFocus).wanderOpacity),
    earlyOpacity
  );

  advance(world, 5);
  const midway = sample();
  assert(
    midway.some((position, index) => {
      const firstX = early[index].x - ring[index].x;
      const firstY = early[index].y - ring[index].y;
      const nextX = position.x - early[index].x;
      const nextY = position.y - early[index].y;
      return Math.abs(firstX * nextY - firstY * nextX) > 0.1;
    })
  );
  advance(world, 25);
  const departed = sample();
  assert(departed.every(offscreen));
  assert(portraits.every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 0.2));
  advance(world, 10);
  assert.deepEqual(sample(), departed);

  timeline.previous();
  assert.deepEqual(sample(), departed);
  assert(portraits.every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 0.2));
  advance(world, 2.4);
  assert.deepEqual(sample(), ring);
  assert(portraits.every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 1));
});

void test('brings Dennis and Kris back from wandering while the robot remains menacing behind them', (t) => {
  const { world, camera, timeline, timelineEntity, maintainers, communityRobot } = createScene(t);
  const dennis = sim.actions(world).createProfile('DennisSmolek', './profiles/DennisSmolek.jpg', 17);
  const kris = sim.actions(world).createProfile('krispya', './profiles/krispya.png', 3);
  const fiber = sim.actions(world).createPackage('@react-three/fiber', 5_129_998, 4, 1.1, 0.86);
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
    sim.systems.wanderProfiles(world);
  };
  timeline.goTo('community-robot');
  advance(world, 22);
  sample();
  const departed = [dennis, kris].map((profile) => ({ ...profile.get(sim.Position) }));
  const cameraPosition = { ...camera.get(sim.Position) };

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainers);
  assert(maintainers.get(sim.Screen).teamVisible);
  assert(maintainers.get(sim.Screen).communityRobotVisible);
  assert.equal(maintainers.get(sim.Screen).robotFriendly, false);
  assert.equal(maintainers.get(sim.Screen).background, 'pastel');
  assert.equal(maintainers.get(sim.Screen).showreelVisible, true);
  assert(fiber.has(sim.Hidden));
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], [dennis, kris]);
  sample();
  assert.deepEqual(
    [dennis, kris].map((profile) => profile.get(sim.Position)),
    departed
  );
  advance(world, 0.5);
  sample();
  assert.deepEqual(
    [dennis, kris].map((profile) => profile.get(sim.Position)),
    departed
  );

  advance(world, 4.5);
  sample();
  const team = [dennis, kris].map((profile) => ({ ...profile.get(sim.Position) }));
  const projected = team.map((position) => position.x / (cameraPosition.z - position.z));
  assert(projected[0] < projected[1]);
  assert(projected[0] < 0 && projected[1] > 0);
  assert(team.every((position) => Math.abs(position.y - cameraPosition.y) < 0.2));
  const apparentSizes = [dennis, kris].map(
    (profile) =>
      (profile.get(sim.Size).radius * profile.get(sim.ProfileFocus).scale) /
      (cameraPosition.z - profile.get(sim.Position).z)
  );
  assert(Math.abs(apparentSizes[0] - apparentSizes[1]) < 1e-9);
  assert([dennis, kris].every((profile) => profile.get(sim.ProfileFocus).recede === 0));
  assert([dennis, kris].every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 1));
  assert.deepEqual(camera.get(sim.Position), cameraPosition);

  advance(world, 3);
  sample();
  const floatingTeam = [dennis, kris].map((profile) => ({ ...profile.get(sim.Position) }));
  assert(
    floatingTeam.every(
      (position, index) => Math.hypot(position.x - team[index].x, position.y - team[index].y) > 0.01
    )
  );
  assert.notEqual(floatingTeam[0].y - team[0].y, floatingTeam[1].y - team[1].y);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), communityRobot);
  assert(!fiber.has(sim.Hidden));
  sample();
  assert.deepEqual(
    [dennis, kris].map((profile) => profile.get(sim.Position)),
    floatingTeam
  );
});

void test('mixes thirteen equally sized profiles before the robot joins the group', (t) => {
  const { world, camera, timeline, timelineEntity, maintainers, maintainerTeam } = createScene(t);
  const names = maintainerTeam.get(sim.Screen).surroundingProfiles;
  for (const [index, login] of names.entries()) {
    if (login !== 'drcmda')
      sim.actions(world).createProfile(login, `./profiles/${login}.png`, index + 1);
  }
  const pair = world
    .query(sim.Profile)
    .filter((profile) => ['DennisSmolek', 'krispya'].includes(profile.get(sim.Profile).login));
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
    sim.systems.wanderProfiles(world);
  };
  timeline.goTo('community-robot');
  advance(world, 22);
  sample();
  timeline.next();
  advance(world, 5);
  sample();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainers);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], pair);
  assert.equal(maintainers.get(sim.Screen).robotFriendly, false);
  const before = pair.map((profile) => ({ ...profile.get(sim.Position) }));
  const cameraPosition = { ...camera.get(sim.Position) };
  const apparent = (profile) =>
    (profile.get(sim.Size).radius * profile.get(sim.ProfileFocus).scale) /
    (cameraPosition.z - profile.get(sim.Position).z);
  const pairSizes = pair.map(apparent);

  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainerTeam);
  assert(maintainerTeam.get(sim.Screen).robotFriendly);
  assert(maintainerTeam.get(sim.Screen).communityRobotVisible);
  assert.equal(maintainerTeam.get(sim.Screen).showreelVisible, false);
  sample();
  assert.deepEqual(
    pair.map((profile) => profile.get(sim.Position)),
    before
  );
  advance(world, maintainerTeam.get(sim.Screen).robotJoinDelay);
  sample();
  const visible = [...world.query(sim.Profile, Not(sim.Hidden))];
  assert.equal(visible.length, 13);
  assert(names.includes('itsdouges'));
  assert.deepEqual(new Set(visible.map((profile) => profile.get(sim.Profile).login)), new Set(names));
  for (const [index, profile] of pair.entries()) {
    assert(apparent(profile) < pairSizes[index]);
    assert(apparent(profile) > pairSizes[index] * 0.65);
  }
  const returning = visible.filter((profile) => !pair.includes(profile));
  assert(returning.every((profile) => Math.abs(apparent(profile) - apparent(pair[0])) < 1e-10));
  assert(pair[0].get(sim.Position).y > cameraPosition.y);
  assert(pair[1].get(sim.Position).y > cameraPosition.y);
  assert(returning.every((profile) => profile.get(sim.ProfileFocus).wanderOpacity === 1));
  const gatheredSizes = visible.map(apparent);
  advance(world, 2.5);
  sample();
  for (const [index, profile] of visible.entries()) {
    assert(Math.abs(apparent(profile) - gatheredSizes[index]) < 1e-10);
  }
  assert.deepEqual(camera.get(sim.Position), cameraPosition);

  const settled = pair.map((profile) => ({ ...profile.get(sim.Position) }));
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), maintainers);
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], pair);
  sample();
  assert.deepEqual(
    pair.map((profile) => profile.get(sim.Position)),
    settled
  );
});

void test('connects all thirteen portraits and the robot in one team network', async () => {
  const { teamLayout } = await server.ssrLoadModule('/src/sim/team-layout.ts');
  const connected = new Set([teamLayout.profiles.length]);
  for (let pass = 0; pass < teamLayout.profiles.length; pass++) {
    for (const [from, to] of teamLayout.connections) {
      assert(from >= 0 && from <= teamLayout.profiles.length);
      assert(to >= 0 && to <= teamLayout.profiles.length);
      if (connected.has(from) || connected.has(to)) {
        connected.add(from);
        connected.add(to);
      }
    }
  }
  assert.equal(connected.size, 14);
});

void test('gathers the principles into the logo behind the curtain, and reverses', (t) => {
  const { world, camera, timeline, timelineEntity, tastefulScreen, logoScreen } = createScene(t);
  timeline.goTo('principles-tasteful');
  advance(world, 4);
  const position = { ...camera.get(sim.Position) };
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), logoScreen);
  assert.equal(logoScreen.get(sim.Screen).id, 'principles-logo');
  assert.equal(logoScreen.get(sim.Screen).principlesLogo, true);
  assert.equal(tastefulScreen.get(sim.Screen).principlesLogo, false);
  // The curtain and the team behind it hold while the words come apart
  const { id: tastefulId, principlesLogo: _, ...held } = tastefulScreen.get(sim.Screen);
  const { id: logoId, principlesLogo: __, ...next } = logoScreen.get(sim.Screen);
  assert.notEqual(tastefulId, logoId);
  assert.deepEqual(next, held);
  assert(logoScreen.get(sim.ScreenTransition).duration >= 2.5);
  advance(world, 4);
  assert.deepEqual(camera.get(sim.Position), position);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), tastefulScreen);
  advance(world, 4);
  assert.deepEqual(camera.get(sim.Position), position);
});

void test('returns from the logo to the charter over the pastel profiles', (t) => {
  const { world, camera, charter, timeline, timelineEntity, logoScreen, charterScreen } =
    createScene(t);
  const profiles = [
    sim.actions(world).createProfile('DennisSmolek', './profiles/DennisSmolek.jpg', 1),
  ];
  timeline.goTo('principles-logo');
  advance(world, 8);
  const focused = { ...camera.get(sim.Position) };
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), charterScreen);
  assert.equal(charterScreen.get(sim.Screen).background, 'pastel');
  assert(!charter.has(sim.Hidden));
  assert.equal(charterScreen.get(sim.Screen).principlesVisible, false);
  assert.deepEqual(camera.get(sim.Position), focused);
  advance(world, charterScreen.get(sim.ScreenTransition).duration);
  sim.systems.floatBodies(world);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: -5 });
  assert.deepEqual([...world.query(sim.Profile, Not(sim.Hidden))], profiles);
  assert(profiles.every((profile) => profile.get(sim.Position).z < charter.get(sim.Position).z));
  assert(charter.get(sim.Position).z < camera.get(sim.Position).z);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), logoScreen);
  assert(charter.has(sim.Hidden));
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
  assert.equal(initiativesScreen.get(sim.Screen).background, 'pastel');
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

void test('holds the circled Initiatives over pastel before leaving the charter, and reverses', (t) => {
  const {
    world,
    camera,
    charter,
    timeline,
    timelineEntity,
    initiativesScreen,
    initiativesFocusScreen,
  } = createScene(t);
  timeline.goTo('charter-initiatives');
  advance(world, initiativesScreen.get(sim.ScreenTransition).duration);
  timeline.next();

  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesFocusScreen);
  assert.equal(initiativesFocusScreen.get(sim.Screen).charterFocus, true);
  assert.equal(initiativesFocusScreen.get(sim.Screen).charterHighlight, 'initiatives');
  assert.equal(initiativesFocusScreen.get(sim.Screen).background, 'pastel');
  assert(!charter.has(sim.Hidden));
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesFocusScreen);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: -5 });

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), initiativesScreen);
  assert.equal(initiativesScreen.get(sim.Screen).charterFocus, false);
  assert(!charter.has(sim.Hidden));
});

void test('keeps the current team through the charter and brings one storyteller down, then back', (t) => {
  const { world, camera, charter, timeline, timelineEntity, maintainerTeam, storyScreen } =
    createScene(t);
  for (const [index, profile] of contributors.entries()) {
    if (profile.login !== 'drcmda')
      sim.actions(world).createProfile(profile.login, profile.avatar, index);
  }
  for (const profile of world.query(sim.Profile, sim.Float))
    profile.set(sim.Float, { amplitude: 0, tilt: 0 });
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
    sim.systems.wanderProfiles(world);
  };
  const names = maintainerTeam.get(sim.Screen).surroundingProfiles;
  const team = world
    .query(sim.Profile)
    .filter((profile) => names.includes(profile.get(sim.Profile).login));
  timeline.goTo('maintainer-team');
  advance(world, 8);
  sample();
  const settled = team.map((profile) => ({ ...profile.get(sim.Position) }));

  for (const id of [
    'principles',
    'principles-tasteful',
    'principles-logo',
    'charter',
    'charter-initiatives',
  ]) {
    timeline.next();
    assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, id);
    assert.deepEqual(
      timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).surroundingProfiles,
      names
    );
    advance(world, 4);
    sample();
    assert.deepEqual(new Set(world.query(sim.Profile, Not(sim.Hidden))), new Set(team));
    assert.deepEqual(
      team.map((profile) => profile.get(sim.Position)),
      settled
    );
  }

  timeline.next();
  advance(world, 2.2);
  sample();
  const gathered = team.map((profile) => ({ ...profile.get(sim.Position) }));
  const sizes = team.map((profile) => profile.get(sim.ProfileFocus).scale);
  const protagonist = team.find(
    (profile) => profile.get(sim.Profile).login === storyScreen.get(sim.Screen).storyProfile
  );
  assert(protagonist, 'The storyteller belongs to the current team');
  const index = team.indexOf(protagonist);
  timeline.next();
  sample();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), storyScreen);
  assert.deepEqual(
    team.map((profile) => profile.get(sim.Position)),
    gathered
  );
  advance(world, 1.2);
  sample();
  const halfway = protagonist.get(sim.Position).y;
  assert(halfway < gathered[index].y);
  advance(world, 1.2);
  sample();
  assert(protagonist.get(sim.Position).y < halfway);
  assert.equal(protagonist.get(sim.Position).x, camera.get(sim.Position).x);
  assert(protagonist.get(sim.ProfileFocus).scale > sizes[index] * 2);
  assert.deepEqual(new Set(world.query(sim.Profile, Not(sim.Hidden))), new Set(team));
  assert(!charter.has(sim.Hidden));
  assert(storyScreen.get(sim.Screen).charterFocus);
  for (const [index, profile] of team.entries()) {
    if (profile !== protagonist) assert.deepEqual(profile.get(sim.Position), gathered[index]);
  }
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), storyScreen);

  sample();
  const beforeReturn = { ...protagonist.get(sim.Position) };
  timeline.previous();
  sample();
  assert.deepEqual(protagonist.get(sim.Position), beforeReturn);
  advance(world, 2.2);
  sample();
  for (const [index, profile] of team.entries()) {
    const position = profile.get(sim.Position);
    assert(Math.hypot(position.x - gathered[index].x, position.y - gathered[index].y) < 1e-9);
    assert(Math.abs(profile.get(sim.ProfileFocus).scale - sizes[index]) < 1e-9);
  }
});

void test('connects the storyteller to the team in a separate step without moving the portraits', (t) => {
  const { world, timeline, timelineEntity, storyScreen, connectionsScreen, announcementScreen } =
    createScene(t);
  for (const [index, profile] of contributors.entries()) {
    if (profile.login !== 'drcmda')
      sim.actions(world).createProfile(profile.login, profile.avatar, index);
  }
  for (const profile of world.query(sim.Profile, sim.Float))
    profile.set(sim.Float, { amplitude: 0, tilt: 0 });
  world.set(sim.Bounds, { width: 16, height: 9 });
  const sample = () => {
    sim.systems.floatBodies(world);
    sim.systems.focusProfiles(world);
  };
  timeline.goTo('initiative-story');
  advance(world, 4);
  sample();
  const team = world.query(sim.Profile, Not(sim.Hidden));
  const positions = team.map((profile) => ({ ...profile.get(sim.Position) }));
  const sizes = team.map((profile) => profile.get(sim.ProfileFocus).scale);
  assert.equal(team.length, 13);
  assert.equal(storyScreen.get(sim.Screen).storyConnectionsVisible, false);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), connectionsScreen);
  assert(connectionsScreen.get(sim.Screen).storyConnectionsVisible);
  assert(connectionsScreen.get(sim.Screen).communityRobotVisible);
  assert.equal(connectionsScreen.get(sim.Screen).storyProfile, 'krispya');
  advance(world, 10);
  sample();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), connectionsScreen);
  assert.deepEqual(
    team.map((profile) => profile.get(sim.Position)),
    positions
  );
  assert.deepEqual(
    team.map((profile) => profile.get(sim.ProfileFocus).scale),
    sizes
  );
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), announcementScreen);
  assert.equal(announcementScreen.get(sim.Screen).storyConnectionsVisible, false);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), connectionsScreen);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), storyScreen);
});

void test('displays the framed announcement after the connections and gives it to the black hole', (t) => {
  const {
    world,
    camera,
    charter,
    timeline,
    timelineEntity,
    storyScreen,
    connectionsScreen,
    announcementScreen,
    constellation,
  } = createScene(t);
  timeline.goTo('initiative-connections');
  advance(world, 3);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), announcementScreen);
  assert(charter.has(sim.Hidden));
  const announcement = announcementScreen.get(sim.Screen);
  assert(announcement.announcementVisible);
  assert.equal(announcement.charterVisible, false);
  assert.equal(announcement.storyProfile, storyScreen.get(sim.Screen).storyProfile);
  assert.deepEqual(announcement.surroundingProfiles, storyScreen.get(sim.Screen).surroundingProfiles);
  assert(announcement.charterFocus);
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), announcementScreen);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: -5 });

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), connectionsScreen);
  assert(!charter.has(sim.Hidden));
  timeline.next();
  advance(world, 3);
  timeline.next();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), constellation);
  assert.equal(constellation.get(sim.Screen).announcementVisible, false);
  assert(constellation.targetFor(sim.PreviousScreen).get(sim.Screen).announcementVisible);
  assert.equal(constellation.targetFor(sim.PreviousScreen).get(sim.Screen).charterVisible, false);
  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), announcementScreen);
  assert(charter.has(sim.Hidden));
});

void test('ejects into space, returns through the portal at PMNDRS, and stops on the sphere preview', (t) => {
  const { world, camera, timeline, timelineEntity, charter, profiles, letter, initiatives } =
    createScene(t);
  timeline.goTo('charter-announcement');
  advance(world, 2.2);
  timeline.next();
  assert(charter.has(sim.Hidden));
  assert([letter, ...profiles].every((entity) => !entity.has(sim.Hidden)));
  assert(initiatives.every((entity) => entity.has(sim.Hidden)));
  advance(world, 4.7);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'portal-fall');
  assert([letter, ...profiles].every((entity) => !entity.has(sim.Hidden)));
  advance(world, 1.2);
  const floating = { ...camera.get(sim.Position) };
  assert(floating.z > 120 && floating.y > 0, 'Drift upward and away while the portal opens');
  advance(world, 1.1);
  const recoil = { ...camera.get(sim.Position) };
  assert(recoil.z > floating.z + 3, 'Recoil from the warning before being pulled back');
  assert(recoil.y > floating.y);
  advance(world, 0.3);
  const crest = camera.get(sim.Position).z;
  advance(world, 0.5);
  const approach = camera.get(sim.Position).z;
  assert(approach < crest);
  advance(world, 0.5);
  assert(approach - camera.get(sim.Position).z > crest - approach, 'Accelerate back toward PMNDRS');
  advance(world, 2);
  assert.equal(camera.get(sim.Position).z, -18, 'Cross the portal at the word origin');
  assert([letter, ...profiles].every((entity) => entity.has(sim.Hidden)));
  const preview = timelineEntity.targetFor(sim.ActiveScreen);
  assert.equal(preview.get(sim.Screen).id, 'initiatives');
  assert.equal(preview.get(sim.Screen).initiativesVisible, true);
  advance(world, 10);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen), preview);

  timeline.previous();
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'charter-announcement');
  assert(charter.has(sim.Hidden));
  timeline.next();
  advance(world, 5);
  timeline.previous();
  advance(world, 8);
  assert.equal(timelineEntity.targetFor(sim.ActiveScreen).get(sim.Screen).id, 'charter-announcement');
});

void test('holds the camera on the framed announcement while it collapses, then pulls away', (t) => {
  const { world, camera, charter, timeline, timelineEntity } = createScene(t);
  timeline.goTo('charter-announcement');
  advance(world, timelineEntity.targetFor(sim.ActiveScreen).get(sim.ScreenTransition).duration);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: -5 });

  timeline.next();
  const { duration, cameraDelay } = timelineEntity
    .targetFor(sim.ActiveScreen)
    .get(sim.ScreenTransition);
  assert(cameraDelay > 1, 'The announcement needs a beat to fall in before the camera leaves');
  assert(charter.has(sim.Hidden));
  advance(world, cameraDelay);
  assert.deepEqual(camera.get(sim.Position), { x: 0, y: 0, z: -5 });
  assert.equal(sim.getRevealProgress(world), 0, 'The space reveal waits for the black hole');
  advance(world, (duration - cameraDelay) / 2);
  assert(camera.get(sim.Position).z > 0 && camera.get(sim.Position).z < 120);
  advance(world, (duration - cameraDelay) / 2);
  assert(Math.abs(camera.get(sim.Position).z - 120) < 0.001);
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
  sim.systems.placeProfiles(world, sim.systems.createProfileLayout(world.query(sim.Profile).length));

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
