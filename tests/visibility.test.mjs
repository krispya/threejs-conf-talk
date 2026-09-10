import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let sim;
let useEntityVisible;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  sim = await server.ssrLoadModule('/src/sim/index.ts');
  ({ useEntityVisible } = await server.ssrLoadModule('/src/view/use-entity-visible.ts'));
});

after(async () => {
  await server?.close();
});

function createScene(t) {
  const world = createWorld(sim.Time, sim.Bounds);
  t.after(() => world.destroy());
  const actions = sim.actions(world);
  const entities = {
    title: actions.createTitle(),
    charter: actions.createCharter(),
    fiber: actions.createPackage('@react-three/fiber', 100, 0, 1),
    three: actions.createPackage('three', 100, 1, 1),
    zustand: actions.createPackage('zustand', 100, 2, 1),
    profile: actions.createProfile('krispya', './profiles/krispya.png', 0),
  };
  const timeline = sim.timelineActions(world);
  timeline.start();
  return { world, entities, timeline };
}

// Server rendering observes the initial animation state before any subscription effects run.
function InitialAppearance({ entity }) {
  const visible = useEntityVisible(entity);
  const [opacity] = useState(visible ? 1 : 0);
  return String(opacity);
}

function initialOpacity(world, entity) {
  return renderToStaticMarkup(
    createElement(WorldProvider, { world }, createElement(InitialAppearance, { entity }))
  );
}

void test('a fresh page initializes only the title as visible, before subscription effects', (t) => {
  const { world, entities } = createScene(t);
  for (const [name, entity] of Object.entries(entities)) {
    assert.equal(initialOpacity(world, entity), name === 'title' ? '1' : '0', name);
  }
});

void test('late asset mounts and return visits initialize from the active screen', (t) => {
  const { world, entities, timeline } = createScene(t);
  for (const [screen, visible] of Object.entries({
    intro: ['title', 'fiber', 'three'],
    charter: ['charter', 'profile'],
    title: ['title'],
  })) {
    timeline.goTo(screen);
    for (const [name, entity] of Object.entries(entities)) {
      assert.equal(
        initialOpacity(world, entity),
        visible.includes(name) ? '1' : '0',
        `${screen}: ${name}`
      );
    }
  }
});
