(function () {
  /*
   * Ritsu Shimmer: holographic glass-chip fill from the Mob Psycho 100 "100%" title.
   * Ported from the WGSL `holoChipShimmerBackground` effect in ~/Tesseract/RitsuShimmer.
   * Like the original, color is multiplied by the alpha of the layer content (uTex).
   */

  var VERT = '#version 300 es\n' +
    'in vec2 aPos;\n' +
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }\n';

  /* The Ritsu Shimmer look as a reusable GLSL function: constants, noise, palette, Voronoi, and
   * shimmer(px, t, shard, rise, frame, hueShift, light, burst) → colour. Shared with the theme transitions. */
  var HOLO_LIB = [
    '',
    '// defaults from the Tesseract project',
    'const float sweepSpeed = 0.425;',
    'const float sweepAngle = 41.8;',
    'const float bandScale = 0.69;',
    'const float density = 0.8;',
    'const float twinkleRate = 2.68;',
    'const float shardPaleness = 0.5;',
    'const float saturation = 1.32;',
    'const float brightness = 0.98;',
    'const float sweepPhase = 0.729;',
    'const float sheen = 1.01;',
    'const float waveCenter = 0.85;',
    'const float waveWidth = 0.055;',
    'const float waveStrength = 0.9;',
    'const float TAU = 6.2831853;',
    'const int LAYERS = 5;',
    '',
    'float hash1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 17151.5453); }',
    'vec2 hash2(vec2 p) {',
    '  vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '  return fract(sin(q) * 43758.5453);',
    '}',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    '',
    'const vec3 STOPS[20] = vec3[20](',
    '  vec3(0.8337, 0.3580, 0.7086), vec3(0.8349, 0.3494, 0.8105), vec3(0.9192, 0.3398, 0.9300),',
    '  vec3(0.9067, 0.3304, 0.9507), vec3(0.6761, 0.3228, 0.9597), vec3(0.4930, 0.2396, 0.9672),',
    '  vec3(0.3675, 0.2346, 0.9660), vec3(0.2979, 0.3798, 0.9644), vec3(0.2616, 0.4883, 0.9723),',
    '  vec3(0.2921, 0.6630, 0.9874), vec3(0.3160, 0.8321, 0.9963), vec3(0.2766, 0.8566, 0.9755),',
    '  vec3(0.2497, 0.8375, 0.8719), vec3(0.3384, 0.8891, 0.8264), vec3(0.4029, 0.9171, 0.8840),',
    '  vec3(0.4017, 0.9442, 0.7516), vec3(0.6308, 0.9925, 0.6860), vec3(0.9226, 0.9749, 0.7033),',
    '  vec3(0.8734, 0.6812, 0.7194), vec3(0.8466, 0.4564, 0.6598)',
    ');',
    'vec3 holo(float h) {',
    '  float x = fract(h) * 20.0;',
    '  int i = int(floor(x)) % 20; int j = (i + 1) % 20;',
    '  return mix(STOPS[i], STOPS[j], smoothstep(0.0, 1.0, fract(x)));',
    '}',
    '',
    'vec3 voronoi(vec2 x) {',
    '  vec2 n = floor(x); vec2 f = x - n;',
    '  vec2 mg = vec2(0.0); vec2 mr = vec2(0.0); float md = 8.0;',
    '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {',
    '    vec2 g = vec2(float(i), float(j));',
    '    vec2 r = g + hash2(n + g) - f;',
    '    float d = dot(r, r);',
    '    if (d < md) { md = d; mr = r; mg = g; }',
    '  }',
    '  float edge = 8.0;',
    '  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {',
    '    vec2 g = mg + vec2(float(i), float(j));',
    '    vec2 r = g + hash2(n + g) - f;',
    '    if (dot(mr - r, mr - r) > 0.00001) edge = min(edge, dot(0.5 * (mr + r), normalize(r - mr)));',
    '  }',
    '  return vec3(edge, n + mg);',
    '}',
    '',
    // ── seamless loop support ──
    // gLoop is the cycle length in seconds (0 = free-running). Only the 100% banner sets it; everything that
    // moves is then rounded to a whole number of cycles per loop, so the frame at gLoop equals the frame at 0.
    'float gLoop = 0.0;',
    'vec2 wrapY(vec2 v, float P) { return P > 0.0 ? vec2(v.x, v.y - P * floor(v.y / P)) : v; }',
    'float loopRate(float r) { return gLoop > 0.0 ? max(1.0, floor(r * gLoop + 0.5)) / gLoop : r; }',
    // straight drift through noise, or a circle of the same speed when looping (returns to its start)
    'vec2 drift(float t, float speed) {',
    '  if (gLoop <= 0.0) return vec2(0.0, t * speed);',
    '  float ph = TAU * t / gLoop; float R = speed * gLoop / TAU;',
    '  return R * vec2(cos(ph) - 1.0, sin(ph));',
    '}',
    // value noise whose lattice repeats every P units in y (P = 0: no wrap)
    'float vnoiseP(vec2 p, float P) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash1(wrapY(i, P)), hash1(wrapY(i + vec2(1.0, 0.0), P)), u.x),',
    '             mix(hash1(wrapY(i + vec2(0.0, 1.0), P)), hash1(wrapY(i + vec2(1.0, 1.0), P)), u.x), u.y);',
    '}',
    // Voronoi whose cells repeat every P rows in y; ids are wrapped too, so a chip keeps its look
    'vec3 voronoiP(vec2 x, float P) {',
    '  vec2 n = floor(x); vec2 f = x - n;',
    '  vec2 mg = vec2(0.0); vec2 mr = vec2(0.0); float md = 8.0;',
    '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {',
    '    vec2 g = vec2(float(i), float(j));',
    '    vec2 r = g + hash2(wrapY(n + g, P)) - f;',
    '    float d = dot(r, r);',
    '    if (d < md) { md = d; mr = r; mg = g; }',
    '  }',
    '  float edge = 8.0;',
    '  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {',
    '    vec2 g = mg + vec2(float(i), float(j));',
    '    vec2 r = g + hash2(wrapY(n + g, P)) - f;',
    '    if (dot(mr - r, mr - r) > 0.00001) edge = min(edge, dot(0.5 * (mr + r), normalize(r - mr)));',
    '  }',
    '  return vec3(edge, wrapY(n + mg, P));',
    '}',
    '',
    'vec3 shimmer(vec2 px, float t, float uShard, float uRise, float uFrame, float uHueShift, vec3 uLight, float uBurst) {',
    '',
    '  float a = sweepAngle * TAU / 360.0;',
    '  vec2 dir = vec2(cos(a), sin(a));',
    '  vec2 pn = px / uFrame;',
    '  float warp = (vnoise(pn * 1.4 + drift(t, 0.2)) - 0.5) * 0.12;',
    '  float baseHue = dot(pn, dir) * bandScale + warp - t * loopRate(sweepSpeed) + sweepPhase + uHueShift;',
    '',
    '  float dw = abs(fract(baseHue - waveCenter + 0.5) - 0.5);',
    '  float wave = exp(-(dw * dw) / max(waveWidth * waveWidth, 0.0001));',
    '  vec2 dl = (px - uLight.xy) / (uFrame * 0.28);',
    '  float spot = uLight.z * exp(-dot(dl, dl));',  // where the light hits the foil
    '  wave = max(wave, spot * 0.85);',
    '',
    '  vec3 col = holo(baseHue) * (1.0 - 0.14 + 0.14 * vnoise(px / (uShard * 1.3) + vec2(3.1, 0.0) + drift(t, 2.0)));',
    '  float hot = 0.0;',
    '',
    '  for (int L = 0; L < LAYERS; L++) {',
    '    float depth = float(L) / float(LAYERS - 1);',
    '    float cell = uShard * (0.7 + 0.8 * depth);',
    '    float rise = uRise * (0.96 + 0.6 * depth + 0.7 * depth * depth);',
    // looping: climb a whole number of chip rows per cycle, and repeat the chip pattern over exactly that
    '    float rows = gLoop > 0.0 ? max(1.0, floor(gLoop * rise / cell + 0.5)) : 0.0;',
    '    if (gLoop > 0.0) rise = rows * cell / gLoop;',
    '    vec2 q = (px + vec2(0.0, t * rise)) / cell + vec2(float(L) * 17.3, float(L) * 7.1);',
    '    vec3 v = voronoiP(q, rows);',
    '    vec2 id = v.yz;',
    '    vec2 h = hash2(id + float(L) * 31.7);',
    '    if (h.x > density) continue;',
    '    float margin = 0.08 + 0.22 * h.y;',
    '    float twinkle = 0.5 + 0.5 * sin(TAU * (hash1(id * 7.7) + t * loopRate(twinkleRate * (0.75 + 0.4 * hash1(id * 1.9)))));',
    '    float kind = hash1(id * 5.3);',
    '    float cs = uShard * 5.0, crows = 0.0;',
    '    if (gLoop > 0.0) { crows = max(1.0, floor(gLoop * rise / cs + 0.5)); cs = gLoop * rise / crows; }',
    '    float clump = smoothstep(0.3, 0.75, vnoiseP((px + vec2(0.0, t * rise)) / cs + float(L) * 3.3, crows));',
    '    bool isPale = kind < (0.212 + 0.54 * depth) * mix(0.4, 2.2, wave) * mix(0.25, 1.9, clump);',
    '    float glint = pow(twinkle, 7.0) * sheen * mix(0.6, 1.0, wave) * mix(0.35, 1.5, clump);',
    '    glint *= 1.0 + 2.4 * spot + 2.0 * uBurst;',
    '    float whiteness = clamp((isPale ? 0.7 + 0.3 * twinkle : 0.0) + glint, 0.0, 1.0);',
    '    float spread = 0.06 * whiteness;',
    '    float soft = 1.9 / cell + 0.1 * whiteness;',
    '    float life = 0.5 + 0.5 * sin(TAU * (hash1(id * 4.1) + t * loopRate(3.0 * (0.8 + 0.4 * hash1(id * 2.3)))));',
    '    float vis = smoothstep(0.102, 0.452, life);',
    '    float cover = smoothstep(margin - spread, margin - spread + soft, v.x) * vis;',
    '    if (cover <= 0.0) continue;',
    '    vec3 tint = holo(baseHue + (hash1(id * 3.1 + float(L)) - 0.5) * 0.08);',
    '    vec3 chip;',
    '    if (isPale) {',
    '      chip = mix(tint, vec3(1.0), clamp(shardPaleness * (1.3 + 0.3 * twinkle), 0.0, 1.0));',
    '    } else if (kind < 0.6) {',
    '      chip = mix(tint, vec3(1.0), clamp(shardPaleness * (0.18 + 0.2 * twinkle), 0.0, 1.0));',
    '    } else {',
    '      float tl = dot(tint, vec3(0.299, 0.587, 0.114));',
    '      chip = mix(vec3(tl), tint, 1.15) * (0.82 + 0.1 * twinkle);',
    '    }',
    '    chip = mix(chip, vec3(1.0, 0.97, 1.0), clamp(glint, 0.0, 0.95));',
    '    chip = mix(chip, vec3(1.0, 0.98, 1.0), clamp(wave * waveStrength * (0.55 + 0.45 * twinkle), 0.0, 0.95));',
    '    col = mix(col, chip, cover * (0.5 + 0.5 * depth));',
    '    hot = max(hot, cover * smoothstep(0.3, 1.0, glint) * mix(0.86, 1.0, depth));',
    '  }',
    '',
    '  float luma = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(luma), col, saturation) * brightness;',
    '  col = mix(col, vec3(1.0), hot);',
    '  return clamp(col, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uShard;',   // shardSize, device px
    'uniform float uRise;',    // riseSpeed, device px / s
    'uniform float uFrame;',   // height the rainbow bands are scaled to, device px
    'uniform vec3 uLight;',    // xy: light position (device px, y down), z: strength 0..1
    'uniform float uHueShift;',// extra offset along the colour cycle (tilting the foil)
    'uniform float uBurst;',   // 0..1, every chip flashes (decays after a click)
    'uniform float uLoop;',    // cycle length in seconds (0 = free-running)
    'uniform float uSpin;',    // record mode: rotation speed in rad/s (0 = off)
    'uniform float uLabel;',   // record mode: centre label radius, as a fraction of the disc radius (0 = none)
    'uniform sampler2D uGlowTex;', // the mask blurred at a few radii (alpha), for the rim of the glow
    'uniform sampler2D uRayTex;',  // light shafts baked from the mask (r), see RAY_FRAG
    'uniform float uGlow;',    // glow strength (0 = none)
    'uniform sampler2D uEdgeTex;', // per direction from the centre: how far out the letters reach (r, canvas heights)
    'out vec4 outColor;',
    HOLO_LIB,
    // ── ambient light around the title, drawn like anime compositing: layered brush strokes fanning out
    // from the letters' edges (a faint haze, a few broad translucent shafts, a scatter of soft tapered
    // streaks), each its own pastel from the shimmer palette, redrawn on threes like hand-drawn "boil" ──
    // the shimmer's rainbow position at a point (what colour the letters are there)
    'float hueAt(vec2 px, float t) {',
    '  float a = sweepAngle * TAU / 360.0;',
    '  vec2 pn = px / uFrame;',
    '  float warp = (vnoise(pn * 1.4 + drift(t, 0.2)) - 0.5) * 0.12;',
    '  return dot(pn, vec2(cos(a), sin(a))) * bandScale + warp - t * loopRate(sweepSpeed) + sweepPhase + uHueShift;',
    '}',
    '',
    // One family of strokes. The circle of directions is cut into n slots, and each slot may hold one stroke:
    // u = direction in turns (turned by rot), r = distance from the centre (canvas heights). Each stroke reads
    // where the letters end and their colour at its own centre line, so it's never cut where those jump.
    // w/l/o = width, length and opacity ranges; soft = edge feather as a share of the width; even = 0 for a
    // spindle that tapers at both ends, 1 for an even shaft; dens = chance a slot is filled; boil = drawing.
    'vec4 strokes(float u, float rot, float r, float n, float seed, vec2 w, vec2 l, vec2 o,',
    '             float soft, float even, float dens, float boil, float hueShift, float t, float px1) {',
    '  vec4 acc = vec4(0.0);',
    '  float x = u * n, slot = floor(x);',
    '  for (int k = -2; k <= 2; k++) {', // wide strokes near the centre reach past the next slot
    '    float id = slot + float(k);',
    '    float s = mod(id, n / 3.0);', // the pattern repeats three times round the circle (see ambience)
    '    if (hash1(vec2(s, seed)) > dens) continue;',
    '    float jit = hash1(vec2(s, seed + 11.0 + boil)) - 0.5;', // this drawing\'s wobble
    '    float c = id + 0.5 + (hash1(vec2(s, seed + 1.7)) - 0.5) * 0.9 + jit * 0.1;',
    '    float cu = c / n + rot;', // the stroke\'s centre line, in turns
    '    float rEdge = texture(uEdgeTex, vec2(fract(cu), 0.5)).r;',
    '    if (rEdge <= 0.0) continue;', // no letters that way
    '    float len = mix(l.x, l.y, hash1(vec2(s, seed + 3.1)));',
    '    float r0 = rEdge + mix(-0.45, 0.35, hash1(vec2(s, seed + 5.3))) * len;', // many start behind the letters
    '    float tt = (r - r0) / len;',
    '    if (tt <= 0.0 || tt >= 1.0) continue;',
    '    float body = sin(3.14159 * tt);',
    '    float width = mix(w.x, w.y, hash1(vec2(s, seed + 7.9))) * (1.0 + 0.2 * jit) * mix(pow(body, 0.8), 1.0, even);',
    '    float lateral = abs(x - c) / n * TAU * r;', // distance across the stroke, canvas heights
    '    float edge = max(px1, soft * width);',
    '    float cov = 1.0 - smoothstep(width - edge, width + edge, lateral);',
    '    if (cov <= 0.0) continue;',
    '    float a = mix(o.x, o.y, hash1(vec2(s, seed + 13.0))) * (1.0 + 0.25 * jit) * cov;',
    '    a *= mix(1.0, 0.35, smoothstep(0.0, 0.4, r - rEdge));', // strongest where it leaves the letters
    '    a *= mix(pow(body, 0.6), smoothstep(0.0, 0.2, tt) * (1.0 - smoothstep(0.45, 1.0, tt)), even);',
    '    vec2 cd = vec2(cos(cu * TAU), sin(cu * TAU));',
    '    float hue = hueAt(uRes * 0.5 + cd * rEdge * uRes.y, t) + hueShift + (hash1(vec2(s, seed + 17.0)) - 0.5) * 0.35;',
    '    vec3 col = holo(hue);',
    '    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 0.75);', // the film\'s light is a little dusty
    '    col = mix(col, vec3(0.9, 0.94, 1.0), 0.15 + 0.5 * hash1(vec2(s, seed + 19.0)));',
    '    acc = vec4(col * a, a) + acc * (1.0 - a);', // painted over what\'s below
    '  }',
    '  return acc;',
    '}',
    '',
    // everything outside the letters: a faint rim hugging them, then the strokes (premultiplied)
    'vec4 ambience(vec2 px, float t) {',
    '  vec2 rel = px - uRes * 0.5;',
    '  float r = length(rel) / uRes.y;',
    '  vec2 d = rel / max(length(rel), 1.0);',
    '  float u = atan(d.y, d.x) / TAU;',
    '  float aa = 1.0 / uRes.y;',
    '  float rim = texture(uGlowTex, px / uRes).a * 0.6;',
    '  vec4 acc = vec4(holo(hueAt(px, t)) * rim, rim);',
    '  float boil = mod(floor(t * 8.0), 3.0);', // 8 drawings a second, cycling three (on threes)
    // The strokes turn with the sweep. To loop seamlessly they turn a third of a circle per loop, and the
    // pattern repeats every third of a circle (slot counts divisible by 3); the letters' outline, colours and
    // haze don't turn, so the repeat doesn't read.
    '  float rot = gLoop > 0.0 ? t / (gLoop * 3.0) : t * 0.04;',
    '  float ur = u - rot;',
    '  float th = ur * TAU * 3.0;',
    '  float clump = smoothstep(0.35, 0.7, vnoise(vec2(cos(th), sin(th)) * 1.2 + 5.0));', // streaks gather in a few places
    '  float haze = texture(uRayTex, px / uRes).r * 0.35;',
    '  vec4 L = vec4(holo(hueAt(px, t) + 0.05) * haze, haze);',
    '  vec4 S;',
    // broad pale shafts, then a scatter of soft streaks
    '  S = strokes(ur, rot, r, 15.0, 3.0, vec2(0.03, 0.1), vec2(0.4, 0.9), vec2(0.14, 0.38), 0.4, 1.0, 0.6, boil, 0.1, t, aa);',
    '  L = S + L * (1.0 - S.a);',
    '  S = strokes(ur, rot, r, 72.0, 21.0, vec2(0.005, 0.014), vec2(0.1, 0.35), vec2(0.15, 0.45), 0.9, 0.0, 0.3 * clump, boil, 0.0, t, aa);',
    '  L = S + L * (1.0 - S.a);',
    // fade out before the card's border, so the light never ends in a hard line
    // (a wide, gentle fade at the sides where there's room; a shorter one above and below the title)
    '  vec2 e = min(px, uRes - px) / (uRes.y * vec2(0.35, 0.14));',
    '  vec2 f = smoothstep(0.0, 1.0, clamp(e, 0.0, 1.0));',
    '  L *= f.x * f.x * f.y;',
    '  acc = L + acc * (1.0 - L.a);',
    '  return acc * uGlow;',
    '}',
    'void main() {',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  vec4 content = texture(uTex, px / uRes);',
    '  gLoop = uLoop;', // makes the shimmer itself periodic (see loop support above)
    '  vec4 amb = uGlow > 0.0 ? ambience(px, uTime) * (1.0 - content.a) : vec4(0.0);', // letters sit over it
    '  if (content.a <= 0.0 && amb.a <= 0.002) { outColor = vec4(0.0); return; }',
    // record mode: a pastel purple label with a spindle hole, and the shimmer turning around it
    '  vec2 ctr = uRes * 0.5; vec2 rel = px - ctr;',
    '  float rr = length(rel) / (min(uRes.x, uRes.y) * 0.5);',
    '  if (uLabel > 0.0 && rr < uLabel) {',
    '    float aa = 1.5 / (min(uRes.x, uRes.y) * 0.5);', // about a pixel, for smooth edges
    '    float hole = smoothstep(uLabel * 0.1, uLabel * 0.1 + aa, rr);',
    '    vec3 lab = vec3(0.80, 0.72, 0.97) * (1.0 - 0.06 * rr / uLabel);', // soft shading toward the rim
    '    lab = mix(lab, vec3(0.62, 0.52, 0.86), smoothstep(uLabel * 0.93, uLabel * 0.97, rr));', // label rim
    '    float a = content.a * hole;',
    '    outColor = vec4(lab * a, a);',
    '    return;',
    '  }',
    '  if (uSpin != 0.0) {',
    '    float ang = -uTime * uSpin;',
    '    float cs = cos(ang), sn = sin(ang);',
    '    px = ctr + vec2(cs * rel.x - sn * rel.y, sn * rel.x + cs * rel.y);',
    '  }',
    '  if (content.a <= 0.0) { outColor = amb; return; }',
    '  vec3 col = shimmer(px, uTime, uShard, uRise, uFrame, uHueShift, uLight, uBurst);',
    '  outColor = vec4(col * content.a, content.a) + amb;',
    '}'
  ].join('\n');

  /* Light shafts, baked once per size: from each pixel, walk toward the centre and add up how much of the
   * (softened) mask lies along the way, weighted by distance. Every edge then throws light straight outward,
   * fading over uLen, and gaps between the letters leave darker lanes between the beams. Output in r. */
  var RAY_FRAG = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uMask;',
    'uniform vec2 uRes;',     // bake size
    'uniform float uLen;',    // how far the light carries, as a fraction of the height
    'uniform float uSoft;',   // mip level of the mask to walk through (softer = broader beams)
    'out vec4 outColor;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float asp = uRes.x / uRes.y;',
    '  vec2 p = vec2(uv.x * asp, uv.y), c = vec2(0.5 * asp, 0.5);', // height units, so beams are straight
    '  vec2 toC = c - p; float dc = length(toC);',
    '  vec2 dir = toC / max(dc, 1e-4);',
    '  float reach = min(dc, 3.0 * uLen);',
    '  const int N = 64;',
    '  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));', // dither the steps
    '  float acc = 0.0;',
    '  for (int i = 0; i < N; i++) {',
    '    float x = (float(i) + j) / float(N) * reach;',
    '    vec2 s = p + dir * x;',
    '    acc += textureLod(uMask, vec2(s.x / asp, s.y), uSoft).a * exp(-x / uLen);',
    '  }',
    '  outColor = vec4(clamp(acc * reach / (float(N) * uLen), 0.0, 1.0), 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /*
   * Creates a renderer on `canvas`. opts.shard / opts.rise are in CSS px.
   * opts.mask(ctx, w, h, dpr) can draw an alpha mask; omit it for a full fill.
   */
  function createHolo(canvas, opts) {
    var gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      antialias: false,
      // keep the last frame: the theme switch's view transition captures canvases outside the normal
      // frame cycle, and without this it can catch them empty (a flash of a blank box)
      preserveDrawingBuffer: true
    });
    if (!gl) return null;

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[holo]', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    function link(fsSrc) {
      var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('[holo]', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }
    var prog = link(FRAG);
    if (!prog) return null;
    var rayProg = opts.glow ? link(RAY_FRAG) : null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      shard: gl.getUniformLocation(prog, 'uShard'),
      rise: gl.getUniformLocation(prog, 'uRise'),
      frame: gl.getUniformLocation(prog, 'uFrame'),
      light: gl.getUniformLocation(prog, 'uLight'),
      hue: gl.getUniformLocation(prog, 'uHueShift'),
      burst: gl.getUniformLocation(prog, 'uBurst'),
      loop: gl.getUniformLocation(prog, 'uLoop'),
      spin: gl.getUniformLocation(prog, 'uSpin'),
      label: gl.getUniformLocation(prog, 'uLabel'),
      tex: gl.getUniformLocation(prog, 'uTex'),
      glowTex: gl.getUniformLocation(prog, 'uGlowTex'),
      rayTex: gl.getUniformLocation(prog, 'uRayTex'),
      glow: gl.getUniformLocation(prog, 'uGlow'),
      edgeTex: gl.getUniformLocation(prog, 'uEdgeTex')
    };

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // mipmapped when there's a glow, so the ray bake can walk through a softened copy of the mask
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, rayProg ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.tex, 0);

    // the glow's two textures (only filled when opts.glow is set): unit 1 the mask blurred outward (the rim),
    // unit 2 the baked light shafts
    function sideTexture(unit) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.activeTexture(gl.TEXTURE0);
      return t;
    }
    var glowTex = sideTexture(1), rayTex = sideTexture(2), edgeTex = sideTexture(3);
    gl.uniform1i(U.glowTex, 1);
    gl.uniform1i(U.rayTex, 2);
    gl.uniform1i(U.edgeTex, 3);
    gl.activeTexture(gl.TEXTURE3);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // directions wrap round the circle
    gl.activeTexture(gl.TEXTURE0);
    var rayFbo = rayProg ? gl.createFramebuffer() : null;

    var maskCanvas = document.createElement('canvas');
    var glowCanvas = opts.glow ? document.createElement('canvas') : null;
    var dpr = 1;

    function resize() {
      // supersample > 1 renders above screen resolution and lets the browser scale it down (smoother chip edges)
      dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2) * (opts.supersample || 1);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      maskCanvas.width = w;
      maskCanvas.height = h;
      paintMask();
      gl.viewport(0, 0, w, h);
    }

    function paintMask() {
      var w = maskCanvas.width, h = maskCanvas.height;
      var mctx = maskCanvas.getContext('2d');
      mctx.clearRect(0, 0, w, h);
      if (opts.mask) opts.mask(mctx, w, h, dpr);
      else { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, w, h); }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
      if (glowCanvas) {
        gl.generateMipmap(gl.TEXTURE_2D);
        paintGlow(w, h);
        bakeRays(w, h);
        traceEdge(w, h);
      }
    }

    // For each of 720 directions from the centre, how far out the letters reach (the silhouette's outer
    // edge), in canvas heights; the strokes start there. Widened by a couple of directions so they start
    // just outside the letters rather than in the notches.
    function traceEdge(w, h) {
      var N = 720, px = maskCanvas.getContext('2d').getImageData(0, 0, w, h).data;
      var cx = w / 2, cy = h / 2, rMax = Math.hypot(cx, cy), step = Math.max(1, h / 400);
      var raw = new Float32Array(N), out = new Uint8Array(N * 4);
      for (var i = 0; i < N; i++) {
        var a = (i + 0.5) / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        for (var r = rMax; r > 0; r -= step) {
          var x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (px[(y * w + x) * 4 + 3] > 127) { raw[i] = r / h; break; }
        }
      }
      for (i = 0; i < N; i++) {
        var m = 0;
        for (var k = -2; k <= 2; k++) m = Math.max(m, raw[(i + k + N) % N]);
        out[i * 4] = Math.min(255, Math.round(m * 255));
      }
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, edgeTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
      gl.activeTexture(gl.TEXTURE0);
    }

    // render RAY_FRAG into rayTex at half size (the shafts are soft, so that's plenty)
    function bakeRays(w, h) {
      var bw = Math.max(1, Math.round(w / 2)), bh = Math.max(1, Math.round(h / 2));
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, rayTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rayFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rayTex, 0);
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(rayProg);
      gl.uniform1i(gl.getUniformLocation(rayProg, 'uMask'), 0);
      gl.uniform2f(gl.getUniformLocation(rayProg, 'uRes'), bw, bh);
      gl.uniform1f(gl.getUniformLocation(rayProg, 'uLen'), 0.2);
      // soften the mask to about 1% of the height, whatever the resolution, so beams stay broad
      gl.uniform1f(gl.getUniformLocation(rayProg, 'uSoft'), Math.max(0, Math.log2(h * 0.012)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
    }

    // The rim of the glow: the mask blurred at two radii and added up, a tight line hugging every edge and a
    // softer band around it. The shafts (bakeRays) carry the light further out.
    function paintGlow(w, h) {
      glowCanvas.width = w;
      glowCanvas.height = h;
      var g = glowCanvas.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      [[0.01, 0.6], [0.03, 0.45]].forEach(function (b) {
        g.globalAlpha = b[1];
        blurInto(g, maskCanvas, b[0] * h, w, h);
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glowTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glowCanvas);
      gl.activeTexture(gl.TEXTURE0);
    }

    var tmp = null;
    function blurInto(ctx, src, r, w, h) {
      if ('filter' in ctx) {
        ctx.filter = 'blur(' + r.toFixed(1) + 'px)';
        ctx.drawImage(src, 0, 0);
        ctx.filter = 'none';
        return;
      }
      // no canvas filters (older Safari): shrink and stretch back, which smooths about as much
      tmp = tmp || document.createElement('canvas');
      var k = Math.max(1, r / 1.5);
      tmp.width = Math.max(1, Math.round(w / k));
      tmp.height = Math.max(1, Math.round(h / k));
      var t = tmp.getContext('2d');
      t.imageSmoothingQuality = 'high';
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.drawImage(src, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, 0, 0, w, h);
    }

    var running = false, raf = 0, t0 = performance.now(), tOffset = opts.timeOffset || 0;

    // light follows the pointer with a little lag; strength and hue shift ease in and out
    var L = { x: 0, y: 0, tx: 0, ty: 0, z: 0, tz: 0, hue: 0, thue: 0, burst: 0 };

    // time can run freely, loop over a fixed length, or be held at a chosen moment (scrubbing)
    var held = null, loopLen = opts.loop || 0;
    function clock(now) {
      if (held !== null) return held;
      var run = (now - t0) / 1000;
      return loopLen ? run % loopLen : tOffset + run;
    }

    function draw(now) {
      var t = reduceMotion && held === null ? 1.5 : clock(now);
      if (opts.onTime) opts.onTime(t);
      L.x += (L.tx - L.x) * 0.22;
      L.y += (L.ty - L.y) * 0.22;
      L.z += (L.tz - L.z) * 0.08;
      L.hue += (L.thue - L.hue) * 0.06;
      L.burst *= 0.94;
      gl.uniform3f(U.light, L.x * dpr, L.y * dpr, L.z);
      gl.uniform1f(U.hue, L.hue);
      gl.uniform1f(U.burst, L.burst);
      gl.uniform1f(U.loop, loopLen);
      gl.uniform1f(U.spin, (opts.spinRpm || 0) * Math.PI * 2 / 60);
      gl.uniform1f(U.label, opts.label || 0);
      gl.uniform1f(U.glow, opts.glow || 0);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, t);
      gl.uniform1f(U.shard, opts.shard * dpr);
      gl.uniform1f(U.rise, opts.rise * dpr);
      gl.uniform1f(U.frame, Math.max(canvas.height, (opts.frame || 0) * dpr));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
      draw(now);
      raf = running && !reduceMotion ? requestAnimationFrame(loop) : 0;
    }

    resize();
    draw(performance.now());

    return {
      start: function () {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(loop);
      },
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
      resize: function () { resize(); draw(performance.now()); },
      // pointer position in CSS px relative to the canvas
      pointer: function (x, y) {
        if (L.tz === 0) { L.x = x; L.y = y; }
        L.tx = x; L.ty = y; L.tz = 1;
        L.thue = (x / canvas.clientWidth - 0.5) * 0.4 + (y / canvas.clientHeight - 0.5) * 0.15;
      },
      leave: function () { L.tz = 0; L.thue = 0; },
      burst: function () { L.burst = 1; },
      // hold the animation at `sec` seconds (for a scrubber)
      seek: function (sec) { held = sec; draw(performance.now()); },
      // resume from where it's held; with loopLen set it repeats over that many seconds
      play: function () {
        if (held === null) return;
        t0 = performance.now() - (loopLen ? held : held - tOffset) * 1000;
        held = null;
      },
      time: function () { return clock(performance.now()); }
    };
  }

  /* ── live canvases: <canvas data-holo data-holo-shard="px" data-holo-rise="px/s"
   *    data-holo-frame="px band height" data-holo-supersample="1.5"> ── */

  /* the Mob Psycho 100 "100%" title, from the traced glyphs in js/ritsu100.js */
  // largest scale at which the title fits with some breathing room (CSS px per source px);
  // fill = share of the height it may take (smaller leaves room for the glow around it)
  function titleFit(w, h, fill) {
    var T = window.RITSU_100;
    return Math.min(w * 0.84 / T.width, h * (fill || 0.8) / T.height);
  }

  function titleMask(ctx, w, h, fill) {
    var T = window.RITSU_100;
    var s = titleFit(w, h, fill);
    var ox = (w - T.width * s) / 2, oy = (h - T.height * s) / 2;
    ctx.fillStyle = '#fff';
    T.polys.forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (pt, i) {
        var x = ox + pt[0] * s, y = oy + pt[1] * s;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    });
  }

  function initHoloTiles() {
    document.querySelectorAll('canvas[data-holo]').forEach(function (canvas) {
      if (canvas.__holo) return;
      canvas.__holo = true;
      makeTile(canvas);
    });
  }

  function makeTile(canvas) {
    var isTitle = canvas.dataset.holoMask === 'title' && window.RITSU_100;
    var opts = {
      mask: isTitle ? function (ctx, w, h) { titleMask(ctx, w, h, opts.fill); } : null,
      shard: parseFloat(canvas.dataset.holoShard) || 11,
      rise: parseFloat(canvas.dataset.holoRise) || 14,
      frame: parseFloat(canvas.dataset.holoFrame) || 0,
      supersample: parseFloat(canvas.dataset.holoSupersample) || 1,
      loop: parseFloat(canvas.dataset.holoLoop) || 0,
      spinRpm: parseFloat(canvas.dataset.holoSpin) || 0,    // record mode (the logo)
      glow: parseFloat(canvas.dataset.holoGlow) || 0,       // ambient halo around the mask's edges
      fill: parseFloat(canvas.dataset.holoFill) || 0.8,     // title: share of the height it fills
      label: parseFloat(canvas.dataset.holoLabel) || 0,
      maxDpr: 2,
      timeOffset: 3
    };
    var host = canvas.closest('.gallery-item') || canvas.parentElement;
    var controls = host && host.querySelector('[data-holo-controls]');
    if (controls) opts.onTime = function (t) { if (controls.__sync) controls.__sync(t); };
    // For the title, scale the Tesseract settings (21px chips, 22px/s rise, 1080px frame) by how big
    // the title is drawn, so it looks like the render at a smaller size.
    function fitTitle() {
      if (!isTitle) return;
      var s = titleFit(canvas.clientWidth, canvas.clientHeight, opts.fill);
      opts.shard = 21 * s;
      opts.rise = 22 * s;
      opts.frame = window.RITSU_100.frameHeight * s;
    }
    fitTitle();
    var holo = createHolo(canvas, opts);
    if (!holo) {
      var item = canvas.closest('.gallery-item');
      if (item) item.classList.add('holo-unsupported');
      else canvas.hidden = true;
      return;
    }
    canvas.__holoApi = holo; // lets other effects read its clock (the logo rays follow its colours)
    canvas.__holoFrame = opts.frame || 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) holo.start(); else holo.stop(); });
      }).observe(canvas);
    } else {
      holo.start();
    }
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!canvas.isConnected) { holo.stop(); return; }
        fitTitle();
        holo.resize();
      }, 150);
    });

    if (canvas.hasAttribute('data-holo-interactive')) {
      canvas.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        holo.pointer(e.clientX - r.left, e.clientY - r.top);
      });
      canvas.addEventListener('pointerleave', function () { holo.leave(); });
      canvas.addEventListener('click', function () { holo.burst(); });
    }

    if (controls) wireControls(controls, holo, opts.loop || 8);
  }

  /* scrubber + loop toggle under a tile: <div data-holo-controls> with .holo-loop, .holo-scrub, .holo-time */
  function wireControls(el, holo, len) {
    var btn = el.querySelector('.holo-loop');
    var scrub = el.querySelector('.holo-scrub');
    var readout = el.querySelector('.holo-time');
    scrub.max = len;
    var looping = true;

    function show(t) {
      if (readout) readout.textContent = t.toFixed(2) + 's';
    }
    el.__sync = function (t) {
      if (!looping) return;
      scrub.value = t;
      show(t);
    };
    function setLooping(on) {
      looping = on;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) holo.play();
      else holo.seek(holo.time());
    }
    btn.addEventListener('click', function () { setLooping(!looping); });
    scrub.addEventListener('input', function () {
      if (looping) setLooping(false);
      var t = parseFloat(scrub.value);
      holo.seek(t);
      show(t);
    });
  }

  var initHolo = initHoloTiles;

  window.initHolo = initHolo;
  window.createHolo = createHolo;
  window.HOLO_LIB = HOLO_LIB;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHolo);
  } else {
    initHolo();
  }
})();
