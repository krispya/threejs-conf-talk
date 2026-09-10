import { screenUV, texture } from 'three/tsl';
import {
  Color,
  Group,
  HalfFloatType,
  Mesh,
  MeshBasicNodeMaterial,
  NodeUpdateType,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  Vector2,
  VideoTexture,
  type WebGPURenderer,
} from 'three/webgpu';
import { showreelColumns, showreelCutaway, showreelTiles } from '../data/showreel.js';
import { coverVideo, type ShowreelMotion } from './showreel-motion.js';

function createClip(url: string, geometry: PlaneGeometry) {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  const map = new VideoTexture(video);
  map.colorSpace = SRGBColorSpace;
  const material = new MeshBasicNodeMaterial({
    map,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { video, map, material, mesh, playing: false };
}

/** The video wall is a single linear-color GPU source shared by the scene and its glass. */
export function createShowreelSource() {
  const target = new RenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  target.texture.name = 'Showreel';
  const node = texture(target.texture, screenUV);
  node.updateBeforeType = NodeUpdateType.NONE;
  const scene = new Scene();
  scene.background = new Color('#080808');
  const wall = new Group();
  scene.add(wall);
  return {
    target,
    node,
    scene,
    wall,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
    geometry: new PlaneGeometry(1, 1),
    clips: [] as ReturnType<typeof createClip>[],
    size: new Vector2(),
    crop: { x: 1, y: 1 },
    reset: 0,
    cut: false,
    ready: false,
    initialized: false,
  };
}

export type ShowreelSource = ReturnType<typeof createShowreelSource>;

/** Media resources are created on commit so discarded React renders never start decoders. */
export function mountShowreel(source: ShowreelSource) {
  source.clips = [...showreelTiles.map((tile) => tile.video), showreelCutaway].map((url) =>
    createClip(url, source.geometry)
  );
  for (const clip of source.clips.slice(0, -1)) source.wall.add(clip.mesh);
  source.scene.add(source.clips.at(-1)!.mesh);
  source.camera.position.z = 1;
}

export function disposeShowreel(source: ShowreelSource) {
  for (const clip of source.clips) {
    clip.playing = false;
    clip.video.pause();
    clip.video.removeAttribute('src');
    clip.video.load();
    clip.map.dispose();
    clip.material.dispose();
    clip.mesh.removeFromParent();
  }
  source.clips.length = 0;
  source.geometry.dispose();
  source.target.dispose();
  source.ready = false;
  source.initialized = false;
}

export function updateShowreelPlayback(
  source: ShowreelSource,
  motion: ShowreelMotion,
  preload: boolean
) {
  if (motion.cut && !source.cut && source.clips.length) source.clips.at(-1)!.video.currentTime = 0;
  source.cut = motion.cut;
  if (source.reset !== motion.reset) {
    for (const clip of source.clips) clip.video.currentTime = 0;
    source.reset = motion.reset;
  }
  const showing = motion.opacity > 0 || motion.visible;
  for (let index = 0; index < source.clips.length; index++) {
    const clip = source.clips[index];
    const selected = (index === source.clips.length - 1) === motion.cut;
    const playing = showing
      ? motion.blackout < 1 && selected
      : preload && index < source.clips.length - 1;
    if (clip.playing === playing) continue;
    clip.playing = playing;
    if (playing) {
      void clip.video.play().catch((error: Error) => {
        if (error.name !== 'AbortError')
          console.warn('Showreel playback failed', clip.video.src, error);
      });
    } else clip.video.pause();
  }
}

/** Render before transmission capture so both passes sample the same decoded video frames. */
export function renderShowreel(
  source: ShowreelSource,
  motion: ShowreelMotion,
  renderer: WebGPURenderer
) {
  if (!source.initialized) {
    renderer.initRenderTarget(source.target);
    source.initialized = true;
  }
  if (motion.opacity <= 0 || motion.blackout >= 1 || !source.clips.length) return;
  renderer.getDrawingBufferSize(source.size);
  const width = Math.max(1, source.size.x);
  const height = Math.max(1, source.size.y);
  source.target.setSize(width, height);
  source.camera.left = -width / 2;
  source.camera.right = width / 2;
  source.camera.top = height / 2;
  source.camera.bottom = -height / 2;
  source.camera.updateProjectionMatrix();
  const gap = width / 120;
  const rows = Math.ceil(showreelTiles.length / showreelColumns);
  const tileWidth = (width - gap * (showreelColumns - 1)) / showreelColumns;
  const tileHeight = (height - gap * (rows - 1)) / rows;
  const cover = Math.max(width / tileWidth, height / tileHeight);
  const scale = 1 + (cover - 1) * motion.zoom;
  const pull = cover * motion.zoom;
  const centerX = (motion.tile % showreelColumns) * (tileWidth + gap) + tileWidth / 2 - width / 2;
  const centerY =
    height / 2 - Math.floor(motion.tile / showreelColumns) * (tileHeight + gap) - tileHeight / 2;
  source.wall.scale.setScalar(scale);
  source.wall.position.set(-centerX * pull, -centerY * pull, 0);
  source.wall.visible = !motion.cut;
  source.ready = false;
  for (let index = 0; index < source.clips.length; index++) {
    const clip = source.clips[index];
    const standalone = index === source.clips.length - 1;
    const frameWidth = standalone ? width : tileWidth;
    const frameHeight = standalone ? height : tileHeight;
    clip.mesh.visible = clip.video.readyState >= 2 && (!standalone || motion.cut);
    if (
      clip.mesh.visible &&
      standalone === motion.cut &&
      (standalone || index === motion.tile || motion.zoom === 0)
    )
      source.ready = true;
    clip.mesh.scale.set(frameWidth, frameHeight, 1);
    clip.mesh.position.set(
      standalone ? 0 : (index % showreelColumns) * (tileWidth + gap) + tileWidth / 2 - width / 2,
      standalone
        ? 0
        : height / 2 - Math.floor(index / showreelColumns) * (tileHeight + gap) - tileHeight / 2,
      0
    );
    if (clip.video.videoWidth && clip.video.videoHeight) {
      coverVideo(
        source.crop,
        clip.video.videoWidth / clip.video.videoHeight,
        frameWidth / frameHeight
      );
      clip.map.repeat.set(source.crop.x, source.crop.y);
      clip.map.offset.set((1 - source.crop.x) / 2, (1 - source.crop.y) / 2);
    }
  }
  const previous = renderer.getRenderTarget();
  const autoClear = renderer.autoClear;
  const cubeFace = renderer.getActiveCubeFace();
  const mipmap = renderer.getActiveMipmapLevel();
  try {
    renderer.setRenderTarget(source.target);
    renderer.autoClear = true;
    renderer.render(source.scene, source.camera);
  } finally {
    renderer.setRenderTarget(previous, cubeFace, mipmap);
    renderer.autoClear = autoClear;
  }
}
