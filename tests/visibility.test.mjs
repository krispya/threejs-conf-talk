import { loadPresentation } from './helpers/load-presentation.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { act, createElement, StrictMode, useState } from 'react';
import { transformSync } from '@babel/core';
import compiler from 'babel-plugin-react-compiler';
import { Window } from 'happy-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let sim;
let useEntityVisible;
let useEntityPresent;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: 'custom',
    plugins: [
      {
        name: 'compile-visibility-hooks',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('/src/view/hooks.ts')) return;
          return transformSync(code, {
            filename: id,
            configFile: false,
            babelrc: false,
            parserOpts: { plugins: ['typescript', 'jsx'] },
            plugins: [[compiler, { target: '19', panicThreshold: 'all_errors' }]],
          }).code;
        },
      },
    ],
  });
  sim = await loadPresentation(server);
  ({ useEntityVisible, useEntityPresent } = await server.ssrLoadModule('/src/view/hooks.ts'));
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
  const entity = timeline.createTimeline(sim.screens.map((screen) => ({ ...screen, requires: [] })));
  timeline.startTimeline(entity);
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

function MountedAppearance({ entity }) {
  const visible = useEntityVisible(entity);
  const present = useEntityPresent(entity);
  return createElement('output', { 'data-visible': visible, 'data-present': present });
}

void test('compiled package views show, retain their exit, and reappear without remounting', async (t) => {
  const dom = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { world, entities, timeline } = createScene(t);
  const host = dom.document.createElement('div');
  const root = createRoot(host);
  const appearance = () => [host.firstChild.dataset.visible, host.firstChild.dataset.present];
  try {
    await act(async () =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(
            WorldProvider,
            { world },
            createElement(MountedAppearance, { entity: entities.fiber })
          )
        )
      )
    );
    const mounted = host.firstChild;
    assert.deepEqual(appearance(), ['false', 'false']);
    await act(async () => timeline.goTo('intro'));
    assert.deepEqual(appearance(), ['true', 'true']);
    await act(async () => timeline.goTo('letters'));
    assert.deepEqual(appearance(), ['false', 'true'], 'The view stays present while exiting');
    await act(async () => {
      sim.systems.updateTime(world, 10, 10);
      sim.systems.animatePackages(world);
    });
    assert.deepEqual(appearance(), ['false', 'false']);
    await act(async () => timeline.goTo('intro'));
    assert.deepEqual(appearance(), ['true', 'true']);
    assert.equal(host.firstChild, mounted);
  } finally {
    await act(async () => root.unmount());
    dom.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});
