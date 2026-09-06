// Glitter / Pearl - dual-mode surface shader
// Shadertoy build. Paste into the Image tab; no channels or buffers required.
//
// Click and drag to place the light. Release and it resumes drifting.
//
// ---------------------------------------------------------------------------
// SHADERTOY DIFFERENCES FROM A STANDALONE PORT
// ---------------------------------------------------------------------------
// Shadertoy prepends its own preamble, which is the opposite of an editor
// like Unicorn Studio that prepends nothing. So, deliberately absent here:
//
//   * no `precision` qualifier   - already declared; redeclaring is an error
//   * no `uniform` declarations  - iTime, iResolution and iMouse are already
//                                  in scope; redeclaring any is an error
//   * no `#version` directive    - Shadertoy manages this
//   * no `void main()`           - the entry point is mainImage(), and the
//                                  output is its `out` parameter, not
//                                  gl_FragColor
//
// Two Shadertoy-specific traps this file handles:
//   * iResolution is a vec3, not a vec2. Use .xy or the divide fails to
//     compile with a dimension mismatch.
//   * iMouse.xy reads (0,0) until the first click, which would pin the light
//     to the bottom-left corner on load. iMouse.z (positive while held) is
//     the standard test for whether the mouse has been used at all.
//
// ---------------------------------------------------------------------------
// CONTROLS
// ---------------------------------------------------------------------------
// Shadertoy has no slider UI, so every control is a const. Edit and the page
// recompiles live. uMode is the theme switch and the most interesting one.
// ---------------------------------------------------------------------------

// Theme: 0.0 = dark glittering mineral, 1.0 = light pearlescent nacre.
// Fractional values crossfade between the two composites.
const float uMode = 0.0;

const float uTrans  = 0.82;   // white-glint transparency (0..1)
const float uRain   = 1.00;   // rainbow / iridescence strength (0..1)
const float uSpread = 1.55;   // spectral band frequency; sets ring radius
const float uSwirl  = 2.00;   // nacre domain-warp magnitude (pearl only)
const float uGlow   = 0.00;   // cursor halo intensity
const float uBase   = 0.00;   // base body tone
const float uCloud  = 0.00;   // broad mottling
const float uGrain  = 460.0;  // fine speckle frequency
const float uDens   = 1.00;   // fraction of cells holding a facet (0..1)
const float uScale  = 191.0;  // facet grid frequency
const float uSharp  = 80.0;  // specular exponent
const float uWhite  = 3.20;   // glint strength

// Automatic light drift, used until the mouse is first clicked.
const vec2 LIGHT_CENTER = vec2(0.00, 0.00);
const vec2 LIGHT_SWING  = vec2(0.55, 0.30);

// --- hashing ---------------------------------------------------------------

float h21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 h22(vec2 p){
  float a = h21(p);
  float b = h21(p + a + 7.13);
  return vec2(a, b);
}
vec3 h33(vec2 p){
  float a = h21(p);
  float b = h21(p + a + 3.71);
  float c = h21(p + b + 9.13);
  return vec3(a, b, c);
}

// --- brand spectrum --------------------------------------------------------
// Cyclic: brand(0.0) == brand(1.0) == purple. Chained mixes rather than a
// lookup table so it stays a pure function with no texture dependency.

vec3 brand(float x){
  float h = fract(x) * 7.0;
  vec3 c = vec3(0.847, 0.333, 0.976);                          // #D855F9
  c = mix(c, vec3(1.000, 0.286, 0.502), clamp(h,       0.0, 1.0)); // #FF4980
  c = mix(c, vec3(1.000, 0.753, 0.263), clamp(h - 1.0, 0.0, 1.0)); // #FFC043
  c = mix(c, vec3(0.922, 1.000, 0.059), clamp(h - 2.0, 0.0, 1.0)); // #EBFF0F
  c = mix(c, vec3(0.792, 0.961, 0.263), clamp(h - 3.0, 0.0, 1.0)); // #CAF543
  c = mix(c, vec3(0.000, 0.969, 0.639), clamp(h - 4.0, 0.0, 1.0)); // #00F7A3
  c = mix(c, vec3(0.169, 0.863, 0.965), clamp(h - 5.0, 0.0, 1.0)); // #2BDCF6
  c = mix(c, vec3(0.847, 0.333, 0.976), clamp(h - 6.0, 0.0, 1.0)); // wrap
  return c;
}

// --- noise -----------------------------------------------------------------

float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; }
  return s;
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 3; i++){ s += a * vn(p); p *= 2.07; a *= 0.5; }
  return s;
}

// Domain-warped field: one noise displaces the coordinates of another.
// This is what produces flowing nacre layers rather than isotropic blobs.
float pfield(vec2 p, float sw, float tt){
  vec2 w = vec2(
    fbm3(p * 1.25 + vec2(0.0,  tt * 0.030)),
    fbm3(p * 1.25 + vec2(5.2, -tt * 0.022))
  );
  return fbm3(p * 2.3 + (w - 0.5) * sw * 3.2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  // iResolution is a vec3 on Shadertoy; .xy is the pixel size.
  vec2  uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t  = iTime;

  // iMouse.xy is in pixels and holds (0,0) until the first click, so a
  // raw read would pin the light to the bottom-left corner. iMouse.z is
  // positive only while the button is held: use it as the 'has the user
  // interacted' test and drift automatically otherwise.
  vec2 lightPos = (iMouse.z > 0.0)
    ? (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y
    : LIGHT_CENTER + vec2(sin(t * 0.32) * LIGHT_SWING.x,
                          cos(t * 0.23) * LIGHT_SWING.y);

  // --- cursor-relative spectral geometry -----------------------------------
  vec2  dl  = uv - lightPos;
  float gd  = length(dl);
  vec2  rad = dl / max(gd, 0.0001);

  // cyc counts full palette rotations outward from the cursor.
  float cyc = gd * uSpread;

  // Two-sided window: white inside cycle 1, one rainbow, white after cycle 2.
  float band = smoothstep(0.78, 1.12, cyc) * (1.0 - smoothstep(1.88, 2.22, cyc));

  // Opacity follows the same curve, so grains appear as they take on color.
  float vis = mix(1.0, band, uTrans);

  // Two-lobe halo: tight core plus wide falloff reads better than one gaussian.
  float halo = exp(-gd * gd * 5.0) * 0.55 + exp(-gd * gd * 26.0) * 0.45;
  float glow = halo * uGlow;

  // --- shared surface fields -----------------------------------------------
  float n1     = fbm(uv * 3.2);
  float n2     = fbm(uv * 11.0 + n1 * 1.5);
  float grain  = vn(uv * uGrain);
  float grain2 = vn(uv * uGrain * 2.7 + 31.4);

  float cw    = mix(0.62, 0.26, clamp(uCloud / 1.5, 0.0, 1.0));
  float cl    = clamp(smoothstep(cw, 0.95, n2) * uCloud, 0.0, 1.0);
  float bodyN = smoothstep(0.28, 0.78, n1);

  // --- mineral body --------------------------------------------------------
  vec3 dk = vec3(0.055, 0.052, 0.062);
  vec3 md = vec3(0.200, 0.190, 0.215);
  vec3 lt = vec3(0.400, 0.385, 0.400);

  vec3 rockD = mix(mix(dk, md, bodyN) * uBase, lt, cl);
  rockD *= 0.84 + 0.24 * grain + 0.10 * grain2;

  // Relief normal from the fbm gradient. Shallow on purpose: the facets are
  // meant to read as one plane, not as a displaced surface.
  float e = 0.012;
  vec2 slope = vec2(
    fbm(uv * 11.0 + vec2(e, 0.0)) - fbm(uv * 11.0 - vec2(e, 0.0)),
    fbm(uv * 11.0 + vec2(0.0, e)) - fbm(uv * 11.0 - vec2(0.0, e))
  );
  vec3 sn = normalize(vec3(-slope * 3.0, 1.0));

  vec3  Lw   = normalize(vec3(lightPos - uv, 0.62));
  float lamb = max(dot(sn, Lw), 0.0);
  rockD *= 0.78 + 0.34 * lamb;

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(Lw + V);

  // --- facet glitter -------------------------------------------------------
  // Single grid, one depth. Each cell holds a facet with a random tilt; it
  // flares only when its normal bisects light and view. 3x3 neighborhood so
  // grains can cross cell borders without popping.
  vec2 gp = uv * uScale;
  vec2 id = floor(gp);
  vec2 gv = fract(gp) - 0.5;

  vec3  sparkD = vec3(0.0);
  float sparkI = 0.0;

  for(int y = -1; y <= 1; y++){
    for(int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y));
      vec3 r = h33(id + o);

      float alive = step(r.x, uDens);
      vec2  cp    = o + (r.yz - 0.5) * 0.82;
      float d     = length(gv - cp);
      float core  = smoothstep(0.13, 0.0, d);

      vec2 tl = (h22(id + o + 11.71) - 0.5) * 1.5;
      tl += 0.05 * vec2(
        sin(t * (0.5 + r.y * 1.3) + r.z * 21.0),
        cos(t * (0.4 + r.z * 1.1) + r.y * 17.0)
      );
      vec3 n = normalize(vec3(tl, 0.72));

      float sp = pow(max(dot(n, H), 0.0), uSharp) * (0.6 + r.z * 0.9);

      // Hue: radial cycle, plus the facet's own tilt projected outward
      // (the dispersion analog), plus a per-grain offset and slow drift.
      float hue = (cyc - 1.0) + dot(tl, rad) * 0.14 + r.y * 0.10 - t * 0.02;

      float bl = 0.22 * exp(-d * d * 90.0);
      float w  = sp * (core + bl) * alive * vis;

      sparkD += mix(vec3(1.0), brand(hue) * 1.25, uRain * band) * w;
      sparkI += w;
    }
  }

  // --- mineral composite (additive over near-black) -------------------------
  vec3 colD = vec3(0.047, 0.039, 0.024) + rockD + sparkD * uWhite * (1.0 + glow * 1.1);
  colD += vec3(0.70, 0.78, 1.00) * glow * 0.10;
  colD += vec3(0.90, 0.93, 1.00) * 0.02 * lamb;
  colD *= 1.0 - 0.42 * dot(uv, uv);
  colD  = colD / (1.0 + colD * 0.85);   // Reinhard
  colD  = pow(colD, vec3(0.82));

  // --- pearl body ----------------------------------------------------------
  // Different model, not an inversion: continuous thin-film interference over
  // a soft warped normal, rather than sparse specular points.
  float nac = pfield(uv, uSwirl, t);

  float pe = 0.010;
  float nx = fbm3((uv + vec2(pe, 0.0)) * 2.3) - fbm3((uv - vec2(pe, 0.0)) * 2.3);
  float ny = fbm3((uv + vec2(0.0, pe)) * 2.3) - fbm3((uv - vec2(0.0, pe)) * 2.3);
  vec3  Np = normalize(vec3(-vec2(nx, ny) * 4.5, 1.0));

  // Anisotropic sample: stretched on x, tight on y, giving lamellae striations.
  float lamin = vn(uv * vec2(3.0, uGrain * 0.55) + 11.0);

  float ct        = max(dot(Np, H), 0.0);
  float sheenExp  = mix(2.0, 22.0, clamp(uSharp / 400.0, 0.0, 1.0));
  float sheen     = pow(ct, sheenExp);
  float fres      = pow(1.0 - ct, 3.0);

  vec3 cream = vec3(0.980, 0.961, 0.918);   // #FAF5EA

  // Base sits at 0.90 of cream so the sheen has headroom to brighten into.
  vec3 pb = cream * (0.900 + 0.060 * nac + 0.035 * lamin);
  pb = mix(pb, pb * 0.80, bodyN * clamp(uBase, 0.0, 1.0));
  pb = mix(pb, vec3(0.760, 0.740, 0.700), cl * 0.55);

  // Interference phase: film thickness + view angle + striations + ring.
  float phase = nac * 1.9 + fres * 1.4 + lamin * 0.30 + cyc * 0.28 - t * 0.03;

  // 28% toward white is what makes this read as sheen rather than printed ink.
  vec3 irid = mix(brand(phase), vec3(1.0), 0.28);

  float ir = uRain * (0.20 + 0.80 * band) * (0.30 + 0.70 * sheen);
  pb  = mix(pb, irid, clamp(ir * 0.62, 0.0, 1.0));
  pb += vec3(0.10, 0.10, 0.095) * sheen * 0.55;

  // Micro-shimmer: same facets, low alpha, tinted by the interference color.
  float ma = clamp(sparkI * uWhite * (1.0 + glow * 1.1) * 0.8, 0.0, 1.0);
  vec3  mt = mix(vec3(0.36, 0.35, 0.33), irid * 0.80, uRain * band);
  pb = mix(pb, mt, ma * 0.50);

  pb += vec3(0.030, 0.026, 0.016) * glow * 0.7;
  pb *= 1.0 - 0.10 * dot(uv, uv);

  // No tone mapping here: the Reinhard curve would crush cream to muddy tan.
  vec3 colL = clamp(pb, 0.0, 1.0);

  fragColor = vec4(mix(colD, colL, uMode), 1.0);
}
