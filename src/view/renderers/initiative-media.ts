import {
  atan,
  color,
  cos,
  exp,
  float,
  hash,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  VideoTexture,
} from 'three/webgpu';
import { brand } from '../../theme.js';

function createClip() {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  const map = new VideoTexture(video);
  map.colorSpace = SRGBColorSpace;
  return { video, map };
}

/**
 * The footage conjured inside the stone portal's opening. A disc at the origin facing +z
 * shows a looping clip through a lens that swirls and fringes toward the rim, wrapped in
 * an energy rim that spills over the stones. The disc is fitted to the ring's inner edge and
 * reaches past it so the glow has room.
 */
export function createInitiativeMedia() {
  const clips = [createClip()];
  let active = clips[0];
  let pending: ReturnType<typeof createClip> | null = null;
  const map = texture(active.map);
  const open = uniform(0);
  const reveal = uniform(0);
  const energy = uniform(1);
  const phase = uniform(0);
  const channel = uniform(0);
  const tint = uniform(new Color(brand.blue));

  // Squaring by multiplication keeps signed distances out of pow, which is NaN for negative
  // bases on Metal and renders black
  const bell = (x: ReturnType<typeof uv>['x']) => exp(x.mul(x).mul(-0.5));
  const point = uv().sub(0.5).mul(2.8);
  const distance = point.length();
  const angle = atan(point.y, point.x);
  const around = vec2(cos(angle), sin(angle));
  // The rim wavers like heat, more while the opening is still forming
  const waver = mx_noise_float(vec3(around.mul(2.2), phase.mul(0.9))).mul(
    open.oneMinus().mul(0.12).add(0.025)
  );
  const radius = open.mul(waver.add(1));
  const edge = distance.sub(radius);
  const inside = smoothstep(-0.03, 0.03, edge).oneMinus();
  // Normalized radius inside the opening drives the lens
  const depth = distance.div(radius.max(0.001));
  const fringe = smoothstep(0.45, 1, depth);
  const twist = fringe
    .pow(2)
    .mul(
      mx_noise_float(vec3(around.mul(1.5), phase.mul(0.35)))
        .mul(0.5)
        .add(0.6)
    )
    .mul(0.28);
  const swirled = angle.add(twist);
  const bulge = depth.pow(1.05);
  const direction = vec2(cos(swirled), sin(swirled));
  // The opening shows the clip's center square, slightly overscanned so the lens has margin
  const sample = (scale: typeof fringe) =>
    map.sample(
      direction
        .mul(bulge.mul(scale))
        .mul(vec2(0.5 * (9 / 16) * 0.92, 0.5 * 0.92))
        .add(0.5)
        .add(vec2(uv().y.mul(90).add(phase.mul(50)).sin().mul(channel).mul(0.012), 0))
    ).rgb;
  const spread = fringe.mul(0.012).add(channel.mul(0.01));
  const footage = vec3(sample(spread.add(1)).r, sample(float(1)).g, sample(spread.oneMinus()).b).mul(
    smoothstep(0.6, 1.02, depth).oneMinus().mul(0.5).add(0.5)
  );
  // A spiral haze fills the opening before the footage blooms through it
  const spiral = angle.add(depth.mul(2.2)).sub(phase.mul(0.8));
  const hazeNoise = mx_fractal_noise_float(
    vec3(vec2(cos(spiral), sin(spiral)).mul(depth.mul(2.4)), phase.mul(0.6)),
    3
  )
    .mul(0.5)
    .add(0.5);
  const haze = mix(color('#291d45'), color('#ac71e5'), hazeNoise.pow(2))
    .mul(hazeNoise.pow(2).mul(0.7).add(0.12))
    .mul(energy.mul(0.5).add(0.5));
  const front = reveal.mul(1.2);
  const shown = smoothstep(front.sub(0.12), front.add(0.08), depth.add(waver.mul(3))).oneMinus();
  const wave = bell(depth.sub(front).div(0.06)).mul(reveal.oneMinus());
  // A brief tuning burst covers the cut while the stone ring stays open
  const staticNoise = hash(uv().mul(480).floor().dot(vec2(127.1, 311.7)).add(phase.mul(30).floor()));
  const signal = mix(footage, vec3(staticNoise).mul(0.65), channel.mul(0.7));
  const inner = mix(haze, signal, shown).add(mix(tint, color('#ffffff'), 0.5).mul(wave).mul(1.5));
  // Tendrils of light ride the rim and drift out over the stones
  const tendril = mx_noise_float(vec3(around.mul(3), phase.mul(1.1)))
    .mul(0.5)
    .add(0.5);
  const core = bell(edge.div(0.009));
  const halo = bell(edge.div(tendril.mul(0.04).add(0.035))).mul(tendril.mul(0.7).add(0.5));
  const wisps = bell(edge.sub(0.05).div(0.35))
    .mul(
      mx_noise_float(vec3(point.mul(3.5), phase.mul(0.8)))
        .max(0)
        .pow(2)
    )
    .mul(smoothstep(0, 0.08, edge));
  // Light gathers at the center before the opening springs to size
  const spark = bell(distance.div(energy.sub(1).mul(0.3).add(0.06))).mul(open.oneMinus());
  const breath = sin(phase.mul(2.3)).mul(0.12).add(1);
  const glow = core
    .mul(0.38)
    .add(halo.mul(0.22))
    .add(wisps.mul(0.45))
    .add(spark.mul(3))
    .mul(energy)
    .mul(breath);
  const rim = mix(
    mix(color('#9970da'), tint, 0.12),
    color('#d5a4ec'),
    sin(angle.mul(3).add(phase.mul(1.4)))
      .mul(0.5)
      .add(0.5)
  );

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.colorNode = mix(
    rim,
    inner.add(rim.mul(glow)).add(color('#ecd8ff').mul(core).mul(energy).mul(0.12)),
    inside
  );
  material.opacityNode = inside.add(glow.mul(inside.oneMinus())).clamp();
  const mesh = new Mesh(new PlaneGeometry(2.8, 2.8), material);
  mesh.name = 'initiative-media';
  // The baked ring's visible inner silhouette, seen from the preview camera, fits a circle
  // just off the origin and a little wider than the bake's unit radius
  mesh.position.set(0.107, -0.203, 0.03);
  mesh.scale.setScalar(1.1);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const start = (video: HTMLVideoElement) =>
    void video.play().catch((error: Error) => {
      if (error.name !== 'AbortError') console.warn('Initiative playback failed', video.src, error);
    });

  return {
    get video() {
      return active.video;
    },
    mesh,
    open,
    reveal,
    energy,
    phase,
    channel,
    playing: false,
    load(url: string, accent: string) {
      tint.value.set(accent);
      if (pending?.video.getAttribute('src') === url) return;
      if (pending && pending !== active) pending.video.pause();
      pending = null;
      if (active.video.getAttribute('src') === url) return;
      let next = clips.find((clip) => clip.video.getAttribute('src') === url);
      if (!next) {
        next = active.video.getAttribute('src') ? createClip() : active;
        if (next !== active) clips.push(next);
        next.video.src = url;
        next.video.load();
      }
      pending = next;
      channel.value = active.video.readyState >= 2 ? 1 : 0;
      if (this.playing) start(next.video);
    },
    updateChannel(delta: number) {
      let changed = false;
      if (pending && pending.video.readyState >= 2 && !pending.video.seeking) {
        if (active !== pending) active.video.pause();
        active = pending;
        pending = null;
        map.value = active.map;
        changed = true;
      }
      if (!pending) channel.value = Math.max(0, channel.value - delta / 0.35);
      return changed;
    },
    setPlaying(playing: boolean) {
      if (this.playing === playing) return;
      this.playing = playing;
      if (!playing) {
        for (const clip of clips) clip.video.pause();
      } else {
        if (active.video.getAttribute('src')) start(active.video);
        if (pending && pending !== active) start(pending.video);
      }
    },
    dispose() {
      this.setPlaying(false);
      pending = null;
      for (const clip of clips) {
        clip.video.removeAttribute('src');
        clip.video.load();
        clip.map.dispose();
      }
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
