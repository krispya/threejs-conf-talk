import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import {
  BackSide,
  Color,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  PerspectiveCamera,
  Texture,
} from 'three/webgpu';
import { texture } from 'three/tsl';

let server;
let video;
let capture;
let conjure;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
  video = await server.ssrLoadModule('/src/view/showreel-motion.ts');
  capture = await server.ssrLoadModule('/src/view/glass/transmission-backdrop.ts');
  conjure = await server.ssrLoadModule('/src/sim/portal-conjure.ts');
});
after(async () => {
  await server?.close();
});

void test('the stone portal appears during descent before the glade and sky, with no blackout at the crossing', () => {
  const light = (elapsed, falling) => conjure.portalArrivalLighting(elapsed, falling, 5.2, 2.6);
  assert.deepEqual(light(2.6, true), { portal: 0, environment: 0, sky: 0 });
  const glimpse = light(3.8, true);
  assert(glimpse.portal > 0);
  assert.equal(glimpse.environment, 0);
  assert.equal(glimpse.sky, 0);
  const arrival = light(5.2, true);
  assert.deepEqual(arrival, light(0, false), 'Lighting continues across the scene transition');
  assert(arrival.portal > arrival.environment && arrival.environment > arrival.sky);
  assert.deepEqual(light(2.3, false), { portal: 1, environment: 1, sky: 1 });
  assert.deepEqual(light(0, true), { portal: 0, environment: 0, sky: 0 });
});

function step(motion, now, overrides = {}) {
  return video.stepShowreel(motion, {
    now,
    visible: true,
    focus: -1,
    duration: 3.8,
    departureAt: -1,
    looming: false,
    exitDelay: 0,
    ...overrides,
  });
}

void test('portal channels keep the outgoing video until the next one is ready and resume on return', async (t) => {
  const { createInitiativeMedia } = await server.ssrLoadModule(
    '/src/view/renderers/initiative-media.ts'
  );
  const originalDocument = globalThis.document;
  const videos = [];
  globalThis.document = {
    createElement: () => {
      const video = {
        currentTime: 0,
        readyState: 0,
        seeking: false,
        paused: true,
        getAttribute(name) {
          return this[name] ?? null;
        },
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        removeAttribute(name) {
          delete this[name];
        },
        load() {},
      };
      videos.push(video);
      return video;
    },
  };
  const media = createInitiativeMedia();
  t.after(() => {
    media.dispose();
    globalThis.document = originalDocument;
  });
  media.setPlaying(true);
  media.load('r3f.mp4', '#8adfff');
  videos[0].readyState = 2;
  media.updateChannel(0.016);
  videos[0].currentTime = 17;

  media.load('glyph.mp4', '#dba5ff');
  media.updateChannel(0.1);
  assert.equal(media.video, videos[0]);
  assert.equal(media.video.paused, false);
  assert.equal(media.channel.value, 1, 'The tuning effect covers loading without closing the portal');
  videos[1].readyState = 2;
  media.updateChannel(0.016);
  assert.equal(media.video, videos[1]);
  assert.equal(media.video.paused, false);
  assert.equal(videos[0].paused, true);
  media.updateChannel(0.4);
  assert.equal(media.channel.value, 0);

  media.load('r3f.mp4', '#8adfff');
  media.updateChannel(0.016);
  assert.equal(media.video, videos[0]);
  assert.equal(media.video.currentTime, 17);
  assert.equal(media.video.paused, false);
  assert.equal(videos[1].paused, true);
  assert.equal(videos.length, 2);

  media.load('glyph.mp4', '#dba5ff');
  media.load('r3f.mp4', '#8adfff');
  media.updateChannel(0.4);
  assert.equal(media.video, videos[0], 'A cancelled change keeps the current channel');
  assert.equal(videos[1].paused, true);
  media.dispose();
  assert(videos.every((video) => video.paused && !video.src));
});

void test('video opens from the hero, closes into R3F, and preserves the cut across following beats', () => {
  const motion = video.createShowreelMotion();
  step(motion, 0);
  step(motion, 3.7);
  assert.equal(motion.opacity, 1);
  assert.equal(motion.zoom, 1);
  step(motion, 6.9);
  assert.equal(motion.zoom, 0);
  step(motion, 8, { focus: 15 });
  step(motion, 10.4, { focus: 15 });
  assert.equal(motion.zoom, 1);
  assert.equal(motion.cut, false);
  step(motion, 11.8, { focus: 15 });
  assert.equal(motion.cut, true);
  const resets = motion.reset;
  step(motion, 12, { focus: 15, departureAt: 12 });
  step(motion, 14, { focus: 15, departureAt: 12 });
  assert(motion.blackout > 0 && motion.blackout < 1);
  assert.equal(motion.cut, true);
  assert.equal(motion.reset, resets);
  step(motion, 19.5, { focus: 15, departureAt: 12 });
  assert.equal(motion.blackout, 1);
  step(motion, 20, { focus: 15, looming: true });
  step(motion, 25, { focus: 15, looming: true });
  assert.equal(motion.blackout, 1);
});

void test('black holds until the robot joins, then video and pastel reverse smoothly on one clock', () => {
  const motion = video.createShowreelMotion();
  step(motion, 0, { focus: 15, looming: true });
  step(motion, 4, { focus: 15, looming: true });
  step(motion, 5, { visible: false, exitDelay: 4.1 });
  step(motion, 9, { visible: false, exitDelay: 4.1 });
  assert.equal(motion.opacity, 1);
  assert.equal(motion.blackout, 1);
  step(motion, 10.2, { visible: false, exitDelay: 4.1 });
  const midway = motion.opacity;
  assert(midway > 0 && midway < 1);
  step(motion, 10.2, { focus: 15, looming: true });
  assert.equal(motion.opacity, midway);
  step(motion, 13, { focus: 15, looming: true });
  assert.equal(motion.opacity, 1);
  step(motion, 14, { visible: false });
  step(motion, 17, { visible: false });
  assert.equal(motion.opacity, 0);
});

void test('video framing center-crops landscape and portrait frames without stretching', () => {
  const crop = { x: 0, y: 0 };
  video.coverVideo(crop, 16 / 9, 1);
  assert.deepEqual(crop, { x: 9 / 16, y: 1 });
  video.coverVideo(crop, 1, 16 / 9);
  assert.deepEqual(crop, { x: 1, y: 9 / 16 });
});

function sceneFixture(t) {
  const backdrop = capture.createTransmissionBackdrop();
  const scene = new Scene();
  scene.background = new Color('#bfcbe9');
  const videoTexture = new Texture();
  scene.backgroundNode = texture(videoTexture);
  const geometry = new PlaneGeometry();
  const glass = [1, 2].map((thickness) => {
    const material = new MeshBasicMaterial();
    material.transmissionUniforms = { thickness: { value: thickness } };
    material.transmissionBackdropConfig = { backside: true, backsideThickness: thickness * 2 };
    capture.registerTransmissionMaterial(backdrop, material);
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    return mesh;
  });
  const label = new Mesh(geometry, new MeshBasicMaterial());
  label.userData[capture.EXCLUDE_FROM_BACKDROP] = true;
  scene.add(label);
  const profile = new Mesh(geometry, new MeshBasicMaterial());
  scene.add(profile);
  const originalTarget = {};
  let target = originalTarget;
  const renderer = {
    autoClear: false,
    toneMappingExposure: 0.8,
    getDrawingBufferSize: (out) => out.set(800, 600),
    getRenderTarget: () => target,
    getActiveCubeFace: () => 2,
    getActiveMipmapLevel: () => 1,
    setRenderTarget: (next) => {
      target = next;
    },
    render: () => {},
  };
  t.after(() => {
    capture.disposeTransmissionBackdrop(backdrop);
    geometry.dispose();
    videoTexture.dispose();
    for (const mesh of [...glass, label, profile]) mesh.material.dispose();
  });
  return { backdrop, scene, glass, label, profile, renderer, originalTarget };
}

void test('all glass shares a capture of the actual video background and profiles, excluding surface labels', (t) => {
  const { backdrop, scene, glass, label, profile, renderer, originalTarget } = sceneFixture(t);
  const background = scene.background;
  const videoNode = scene.backgroundNode;
  let passes = 0;
  renderer.render = (capturedScene) => {
    assert.equal(capturedScene.background, background);
    assert.equal(capturedScene.backgroundNode, videoNode);
    assert.equal(label.visible, false);
    assert.equal(profile.visible, true);
    assert.equal(renderer.toneMappingExposure, 0.8);
    if (passes++ === 0) assert(glass.every((mesh) => !mesh.visible));
    else assert(glass.every((mesh) => mesh.visible && mesh.material.side === BackSide));
  };
  capture.captureTransmissionBackdrop(backdrop, renderer, scene, new PerspectiveCamera(), 1);
  capture.captureTransmissionBackdrop(backdrop, renderer, scene, new PerspectiveCamera(), 1);
  assert.equal(passes, 2);
  assert.equal(backdrop.textureNode.value, backdrop.backsideTarget.texture);
  assert(glass.every((mesh) => mesh.visible && mesh.material.side === FrontSide));
  assert.equal(label.visible, true);
  assert.equal(renderer.getRenderTarget(), originalTarget);
  assert.equal(renderer.autoClear, false);
});

void test('a failed capture restores visibility, current thickness, renderer target, and prior video capture', (t) => {
  const { backdrop, scene, glass, label, renderer, originalTarget } = sceneFixture(t);
  glass[0].material.transmissionUniforms.thickness.value = 9;
  const previousTexture = backdrop.textureNode.value;
  let passes = 0;
  renderer.render = () => {
    if (++passes === 2) throw new Error('capture failed');
  };
  assert.throws(
    () => capture.captureTransmissionBackdrop(backdrop, renderer, scene, new PerspectiveCamera(), 1),
    /capture failed/
  );
  assert(glass.every((mesh) => mesh.visible && mesh.material.side === FrontSide));
  assert.equal(glass[0].material.transmissionUniforms.thickness.value, 9);
  assert.equal(label.visible, true);
  assert.equal(backdrop.textureNode.value, previousTexture);
  assert.equal(renderer.getRenderTarget(), originalTarget);
  assert.equal(renderer.autoClear, false);
});

void test('video resources pause under blackout and are released across mount and cleanup cycles', async (t) => {
  const sourceModule = await server.ssrLoadModule('/src/view/showreel-source.ts');
  const originalDocument = globalThis.document;
  const elements = [];
  globalThis.document = {
    createElement: () => {
      const element = {
        currentTime: 0,
        paused: true,
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        removeAttribute(name) {
          delete this[name];
        },
        load() {},
      };
      elements.push(element);
      return element;
    },
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });
  const source = sourceModule.createShowreelSource();
  assert.equal(elements.length, 0);
  const motion = video.createShowreelMotion();
  for (let mount = 0; mount < 2; mount++) {
    sourceModule.mountShowreel(source);
    assert.equal(source.clips.length, 17);
    assert.equal(source.wall.children.length, 16);
    assert.equal(source.scene.children.length, 2);
    sourceModule.updateShowreelPlayback(source, motion, true);
    assert.equal(source.clips.filter((clip) => !clip.video.paused).length, 16);
    motion.visible = true;
    motion.blackout = 1;
    source.clips[0].video.currentTime = 7;
    sourceModule.updateShowreelPlayback(source, motion, false);
    assert(source.clips.every((clip) => clip.video.paused));
    assert.equal(source.clips[0].video.currentTime, 7);
    sourceModule.disposeShowreel(source);
    assert.equal(source.wall.children.length, 0);
    assert.equal(source.scene.children.length, 1);
    assert(elements.every((element) => element.paused && !element.src));
    motion.visible = false;
    motion.blackout = 0;
  }
});
