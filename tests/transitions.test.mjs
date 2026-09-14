import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld } from 'koota';
import { createServer } from 'vite';

let server;
let sim;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  sim = Object.assign(
    {},
    ...(await Promise.all([
      server.ssrLoadModule('/src/transition/actions.ts'),
      server.ssrLoadModule('/src/transition/traits.ts'),
      server.ssrLoadModule('/src/transition/systems.ts'),
      server.ssrLoadModule('/src/timeline/traits.ts'),
      server.ssrLoadModule('/src/time/traits.ts'),
    ]))
  );
});
after(async () => {
  await server?.close();
});

function scene(t) {
  const world = createWorld(sim.Time);
  t.after(() => world.destroy());
  const screen = world.spawn(sim.ScreenTransition({ revealDelay: 0.5 }));
  const timeline = world.spawn(sim.Timeline({ duration: 2 }), sim.ActiveScreen(screen));
  const actions = sim.transitionActions(world);
  const transition = actions.createTransition();
  return {
    world,
    timeline,
    actions,
    transition,
    value: () => transition.get(sim.Transition).value,
    step: (elapsed, delta = 1 / 60) => {
      world.set(sim.Time, { elapsed, delta });
      sim.advanceTransitions(world);
    },
  };
}

void test('world transitions advance and reverse from the current value without a mounted view', (t) => {
  const { timeline, actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1);
  step(1);
  assert.equal(value(), 0.875);
  timeline.set(sim.Timeline, { startedAt: 1 });
  actions.setTransition(transition, 0);
  assert.equal(value(), 0.875);
  step(1);
  assert.equal(value(), 0.875);
  step(2);
  assert.equal(value(), 0.109375);
  step(3);
  assert.equal(value(), 0);
});

void test('a transition retains its timing until a command retargets it', (t) => {
  const { timeline, actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1);
  step(1);
  timeline.set(sim.Timeline, { startedAt: 1, duration: 20 });
  step(2);
  assert.equal(value(), 1, 'A new screen cannot mix its timing into the previous fade');
});

void test('screen reveals honor their delay and explicit fades use their own curve and duration', (t) => {
  const { actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1, { delayed: true });
  step(0.5);
  assert.equal(value(), 0);
  step(1.25);
  assert.equal(value(), 0.875);
  step(2);
  assert.equal(value(), 1);
  actions.setTransition(transition, 0, { duration: 4, delay: 1, ease: (x) => x });
  step(3);
  assert.equal(value(), 0.5);
  step(5);
  assert.equal(value(), 0);
});

void test('assets that become ready late still receive a complete entrance', (t) => {
  const { actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1, { ready: false });
  step(10);
  assert.equal(value(), 0);
  actions.setTransition(transition, 1, { ready: true });
  step(10);
  assert.equal(value(), 0);
  step(11);
  assert.equal(value(), 0.875);
  step(12);
  assert.equal(value(), 1);
});

void test('frame-clock entrances preserve their first frame and cap progress through rendering stalls', (t) => {
  const { actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1, { clock: 'frames', duration: 1, ease: (x) => x });
  step(10, 10);
  assert.equal(value(), 0);
  step(20, 10);
  assert.equal(value(), 1 / 30);
  for (let frame = 0; frame < 60; frame++) step(21 + frame / 60);
  assert.equal(value(), 1);
});

void test('content changes can replay entrances and visibility changes can explicitly restart exits', (t) => {
  const { world, actions, transition, value, step } = scene(t);
  actions.setTransition(transition, 1, { restartKey: 'first', clock: 'frames', duration: 1 });
  step(0);
  step(1 / 60);
  assert(value() > 0);
  actions.setTransition(transition, 1, { restartKey: 'second', clock: 'frames', duration: 1 });
  assert.equal(value(), 0);
  actions.setTransition(transition, 0, { restartOnChange: true });
  assert.equal(value(), 1);
  step(2);
  assert.equal(value(), 0);
  actions.destroyTransition(transition);
  actions.destroyTransition(transition);
  assert.equal(world.query(sim.Transition).length, 0);
});
