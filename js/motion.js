(function () {
  /*
   * Motion system. One easing family, three speeds, one stagger.
   *   enter  — things arriving: long ease-out, 520–900ms
   *   leave  — things going away: short ease-in, 160–180ms (exits are always faster than entrances)
   *   stagger — 55ms between siblings, capped so nothing waits longer than ~0.6s
   * Everything is skipped under prefers-reduced-motion; every element's resting state is its normal state.
   */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STAGGER = 55;
  var STAGGER_CAP = 600;
  var LEAVE_MS = 170;

  var REVEAL = [
    '.landing-head', '.page-label', '.sec-label', '.gallery-note',
    '.bio > p', '.about-photo-wrap', '.plain-list li', '.edu-entry', '.exp-item',
    '.proj-item', '.gallery-item', '.pub-label', '.pub-item',
    '.resume-header', '.resume-section',
    '.contact-note', '.c-row',
    '.wf-intro', '.wf', '.wf-help',
    '.surprise-intro', '.surprise-fact', '.surprise-controls',
    '.pomodoro-phase', '.pomodoro-time', '.pomodoro-controls', '.pomodoro-presets',
    '.flappy-score-wrap', '.flappy-hint', '.flappy-canvas-wrap'
  ].join(',');

  function kindOf(el) {
    if (el.matches('.page-label, .sec-label')) return 'wipe';
    if (el.matches('.about-photo-wrap')) return 'dither';
    return 'rise';
  }

  /* ── dither dissolve: the photo develops through a 4×4 Bayer screen, top to bottom ── */

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function ditherPrep(wrap) {
    var img = wrap.querySelector('img');
    if (!img) return null;
    var w = img.offsetWidth, h = img.offsetHeight;
    if (!w || !h) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cell = 3;
    var cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    var c = document.createElement('canvas');
    c.className = 'm-dissolve';
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    wrap.appendChild(c);
    var ctx = c.getContext('2d');
    var cs = getComputedStyle(document.documentElement);
    var bg = cs.getPropertyValue('--bg').trim() || '#fff';
    var ink = cs.getPropertyValue('--accent').trim() || '#8f72df';
    var px = cell * dpr;

    // threshold per cell: mostly the Bayer rank, partly the row, so it sweeps downward
    var th = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        th[y * cols + x] = ((BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16) * 0.55 + (y / rows) * 0.45;
      }
    }

    var BAND = 0.14; // cells this close to the front flash accent before turning clear

    function paint(p) {
      ctx.clearRect(0, 0, c.width, c.height);
      for (var i = 0; i < th.length; i++) {
        var t = th[i];
        if (t < p - BAND) continue;
        ctx.fillStyle = t >= p ? bg : ink;
        ctx.fillRect((i % cols) * px, Math.floor(i / cols) * px, px, px);
      }
    }
    paint(0);

    return function play(delay) {
      var DUR = 1000;
      var start = performance.now() + (delay || 0);
      function frame(now) {
        var k = Math.min(1, Math.max(0, (now - start) / DUR));
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease-in-out cubic
        paint(e * (1 + BAND));
        if (k < 1) requestAnimationFrame(frame);
        else c.remove();
      }
      requestAnimationFrame(frame);
    };
  }

  /* ── generic reveal ── */

  function prep(el) {
    var kind = kindOf(el);
    if (kind === 'dither') {
      el.__mPlay = ditherPrep(el);
      return;
    }
    el.classList.add(kind === 'wipe' ? 'm-wipe' : 'm-rise');
  }

  function play(el, delay) {
    if (el.__mPlay) {
      el.__mPlay(delay);
      el.__mPlay = null;
      return;
    }
    if (!el.classList.contains('m-wipe') && !el.classList.contains('m-rise')) return;
    el.style.setProperty('--m-delay', delay + 'ms');
    el.classList.add('m-in');
    var done = function (e) {
      if (e && e.target !== el) return;
      el.classList.remove('m-rise', 'm-wipe', 'm-in');
      el.style.removeProperty('--m-delay');
      el.removeEventListener('transitionend', done);
    };
    el.addEventListener('transitionend', done);
    setTimeout(done, delay + 1200); // in case transitionend never fires
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    var i = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      play(en.target, Math.min(i++ * STAGGER, STAGGER_CAP));
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;

  /* Stagger in what's on screen now; hold everything below the fold until it scrolls in. */
  function enter(root, base) {
    if (reduce || !root || document.hidden) return;
    base = base || 0;
    var vh = window.innerHeight;
    var now = [];
    root.querySelectorAll(REVEAL).forEach(function (el) {
      if (el.classList.contains('m-skip')) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < 0) return; // already scrolled past (e.g. landing on #gallery)
      if (r.top < vh * 0.96) now.push(el);
      else if (io) { prep(el); io.observe(el); }
    });
    now.forEach(prep);
    // two frames so the prepared state paints before the transition starts
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        now.forEach(function (el, i) { play(el, base + Math.min(i * STAGGER, STAGGER_CAP)); });
      });
    });
  }

  /* ── landing intro ── */

  function maskLine(el) {
    var inner = document.createElement('span');
    inner.className = 'm-line-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    var outer = document.createElement('span');
    outer.className = 'm-line';
    outer.appendChild(inner);
    el.appendChild(outer);
  }

  function splitLetters(h1) {
    if (h1.querySelector('.m-ch')) return;
    var text = h1.textContent.trim();
    h1.setAttribute('aria-label', text);
    var k = 0;
    h1.innerHTML = text.split(' ').map(function (word) {
      return '<span class="m-word" aria-hidden="true">' + word.split('').map(function (ch) {
        return '<span class="m-ch" style="--i:' + (k++) + '">' + ch + '</span>';
      }).join('') + '</span>';
    }).join(' ');
  }

  function intro(main) {
    var eyebrow = main.querySelector('.home-eyebrow');
    var name = main.querySelector('.home-name');

    var head = main.querySelector('.landing-head');
    if (head) head.classList.add('m-skip'); // the header has its own choreography below
    if (eyebrow) maskLine(eyebrow);
    if (name) splitLetters(name);

    var chrome = document.querySelectorAll('.sidebar-logo, .sidebar-nav li:not(.nav-cursor)');
    chrome.forEach(function (el) { el.classList.add('m-rise', 'm-rise-x'); });

    document.documentElement.classList.add('m-intro');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add('m-intro-play');
        chrome.forEach(function (el, i) { play(el, 250 + i * 40); });
        setTimeout(function () {
          document.documentElement.classList.remove('m-intro', 'm-intro-play');
        }, 2200);
      });
    });

    // content follows once the name has mostly landed
    enter(main, 520);
  }

  /* ── page transitions (called by spa.js) ── */

  // Old page leaves fast (fade + 6px lift), then swap() puts the new <main> in and it staggers in.
  // Done with plain CSS on the live page, so nothing on it stops moving.
  function transition(swap) {
    var main = document.querySelector('main');
    if (reduce || document.hidden || !main) { swap(); return Promise.resolve(); }
    main.classList.add('m-leaving');
    return new Promise(function (res) {
      setTimeout(function () { swap(); res(); }, LEAVE_MS);
    });
  }

  /* ── theme: sunrise / sunset ──
   * The horizon point sits just below the bottom centre of the screen.
   *   → light (sunrise): daylight spreads outward from the horizon, led by a band of sky colour
   *     (pink at the front, then coral, then gold nearest the light).
   *   → dark (sunset): night closes in from the corners toward the horizon, led by
   *     orange, then magenta, then indigo.
   * The bands blend with ordered dither instead of smooth gradients. At full cover the theme flips
   * underneath, and the curtain dissolves through the dither screen to reveal the new page.
   * Drawn on a low-res canvas scaled up with hard pixels; the page keeps running underneath.
   */

  var THEME_BG = { light: [255, 255, 255], dark: [15, 15, 15] }; // --bg in style.css
  var SKY = {
    light: [[222, 104, 170], [255, 138, 112], [255, 205, 128]], // front → back
    dark: [[255, 150, 80], [196, 82, 140], [72, 52, 128]]
  };
  var BAYER8 = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];
  var CELL = 4;       // css px per dither dot
  var BAND = 0.2;     // how much of the sweep the sky band takes up
  var themeBusy = false;

  function skyTheme(apply, next) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cols = Math.ceil(vw / CELL), rows = Math.ceil(vh / CELL);
    var c = document.createElement('canvas');
    c.className = 'm-theme-curtain';
    c.width = cols;
    c.height = rows;
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(cols, rows);
    var d = img.data;

    var rising = next === 'light';
    var hx = cols / 2, hy = rows * 1.12; // horizon, just below the screen
    var far = Math.max(Math.hypot(hx, hy), Math.hypot(cols - hx, hy));
    var th = new Float32Array(cols * rows);  // when each dot is reached, 0..1
    var dith = new Float32Array(cols * rows); // its Bayer rank, 0..1
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var r = Math.hypot(x - hx, y - hy) / far;
        dith[i] = (BAYER8[y % 8][x % 8] + 0.5) / 64;
        // a little dither in the edge itself so the circle breaks up into dots
        var t = (rising ? r : 1 - r) * 0.94 + dith[i] * 0.06;
        th[i] = t;
      }
    }

    var bg = THEME_BG[next], stops = SKY[next];

    function put(j, col) { d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255; }

    // p runs 0 → 1 + BAND. Dots behind the band are the new sky, dots in it are sky colour.
    function paintSweep(p) {
      for (var i = 0, j = 0; i < th.length; i++, j += 4) {
        var t = th[i];
        if (t >= p) { d[j + 3] = 0; continue; }
        var u = (p - t) / BAND; // 0 at the front of the band, 1 at its back
        if (u >= 1) { put(j, bg); continue; }
        // pick between neighbouring stops (or the new bg past the last) by comparing to the Bayer rank
        var v = u * stops.length, k = Math.floor(v);
        var col = (v - k) > dith[i] ? (k + 1 < stops.length ? stops[k + 1] : bg) : stops[k];
        put(j, col);
      }
      ctx.putImageData(img, 0, 0);
    }

    // uniform ordered-dither dissolve of the covering sky
    function paintDissolve(p) {
      for (var i = 0, j = 0; i < th.length; i++, j += 4) {
        if (dith[i] < p) d[j + 3] = 0;
        else put(j, bg);
      }
      ctx.putImageData(img, 0, 0);
    }

    function run(dur, ease, paint, to) {
      return new Promise(function (res) {
        var start = performance.now();
        (function frame(now) {
          var k = Math.min(1, (now - start) / dur);
          paint(ease(k) * to);
          if (k < 1) requestAnimationFrame(frame);
          else res();
        })(start);
      });
    }
    var inOut = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var outCubic = function (k) { return 1 - Math.pow(1 - k, 3); };

    themeBusy = true;
    paintSweep(0);
    return run(rising ? 760 : 820, inOut, paintSweep, 1 + BAND + 0.01).then(function () {
      apply();
      return run(360, outCubic, paintDissolve, 1.01);
    }).then(function () {
      c.remove();
      themeBusy = false;
    });
  }

  /* ── theme, take 2 and 3: made of the Ritsu Shimmer itself ──
   * Both use shimmer() from holo.js (window.HOLO_LIB), so the crystals are the real shader: the rainbow
   * base, five layers of rising glass chips, the twinkle and the sheen band.
   *
   * Dark 2 (crystallize): a front sweeps at the shader's 41.8° angle. Ahead of the rainbow base, the
   *   shader's own glass chips arrive one by one and flash, and the base fills in behind them until the
   *   whole screen is the shimmer. The theme flips underneath; then the base drops out first, leaving
   *   the chips floating over the new page for a moment before they wink out.
   * Dark 3 (line): a band of shimmer crystals sweeps left to right. Behind it (left) is the new theme,
   *   ahead of it (right) the old one. Uses a view transition; the logo gets its own live layer so it keeps
   *   shimmering, and the background, sidebar and content are each split by the line.
   */

  // shared GLSL setup for a full-screen pass
  function glPass(canvas, mainSrc, uniforms, maxDpr, sizer) {
    if (!window.HOLO_LIB) return null;
    var gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      antialias: false,
      // keep the last frame: the theme switch's view transition captures canvases outside the normal
      // frame cycle, and without this it can catch them empty (a flash of a blank box)
      preserveDrawingBuffer: true
    });
    if (!gl) return null;
    var src = ['#version 300 es', 'precision highp float;']
      .concat(uniforms.map(function (u) { return 'uniform ' + u[1] + ' ' + u[0] + ';'; }))
      .concat(['out vec4 outColor;', window.HOLO_LIB, mainSrc]).join('\n');
    function sh(type, code) {
      var o = gl.createShader(type); gl.shaderSource(o, code); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.error('[theme fx]', gl.getShaderInfoLog(o)); return null; }
      return o;
    }
    var vs = sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 aPos;\nvoid main(){gl_Position=vec4(aPos,0.0,1.0);}\n');
    var fs = sh(gl.FRAGMENT_SHADER, src);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    uniforms.forEach(function (u) { U[u[0]] = gl.getUniformLocation(prog, u[0]); });

    var api = {
      gl: gl, U: U, dpr: 1,
      // match the window; call again before reusing the renderer
      size: function () {
        var dpr = api.dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 1.25);
        var box = sizer ? sizer() : { w: window.innerWidth, h: window.innerHeight };
        var w = Math.max(1, Math.round(box.w * dpr)), h = Math.max(1, Math.round(box.h * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        // the Tesseract settings (21px chips, 22px/s, 1080px frame) scaled to this screen, so a small
        // canvas shows the same size chips as a full-screen one
        var screenH = window.innerHeight * dpr, k = screenH / 1080;
        gl.uniform2f(U.uRes, w, h);
        gl.uniform1f(U.uShard, 21 * k);
        gl.uniform1f(U.uRise, 22 * k);
        gl.uniform1f(U.uFrame, screenH);
      },
      draw: function () {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      dispose: function () {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
    api.size();
    return api;
  }

  var BASE_UNIFORMS = [['uRes', 'vec2'], ['uTime', 'float'], ['uShard', 'float'], ['uRise', 'float'], ['uFrame', 'float']];

  // Dark 2. uniforms (declared by glPass): uP front progress 0 → 1.22, uReveal 0 = forming / 1 = dissolving.
  // shimmerGate() is the shimmer shader with a front: each of its glass chips appears (or leaves) when the
  // front reaches it, and the rainbow base follows a little behind. Returns premultiplied colour.
  var CRYSTAL_MAIN = [
    'const float LAG = 0.1;', // how far the rainbow base trails the chips
    'vec4 shimmerGate(vec2 px, float t, float uShard, float uRise, float uFrame, float s, float gp, float reveal) {',
    '  float a = sweepAngle * TAU / 360.0;',
    '  vec2 dir = vec2(cos(a), sin(a));',
    '  vec2 pn = px / uFrame;',
    '  float warp = (vnoise(pn * 1.4 + vec2(0.0, t * 0.2)) - 0.5) * 0.12;',
    '  float baseHue = dot(pn, dir) * bandScale + warp - t * sweepSpeed + sweepPhase;',
    '  float dw = abs(fract(baseHue - waveCenter + 0.5) - 0.5);',
    '  float wave = exp(-(dw * dw) / max(waveWidth * waveWidth, 0.0001));',
    '  float baseA = reveal < 0.5 ? smoothstep(0.0, 0.06, gp - s - LAG) : 1.0 - smoothstep(0.0, 0.06, gp - s);',
    '  vec3 C = holo(baseHue) * (1.0 - 0.14 + 0.14 * vnoise(px / (uShard * 1.3) + vec2(3.1, t * 2.0))) * baseA;',
    '  float A = baseA;',
    '  float hot = 0.0;',
    '  for (int L = 0; L < LAYERS; L++) {',
    '    float depth = float(L) / float(LAYERS - 1);',
    '    float cell = uShard * (0.7 + 0.8 * depth);',
    '    float rise = uRise * (0.96 + 0.6 * depth + 0.7 * depth * depth);',
    '    vec2 q = (px + vec2(0.0, t * rise)) / cell + vec2(float(L) * 17.3, float(L) * 7.1);',
    '    vec3 v = voronoi(q);',
    '    vec2 id = v.yz;',
    '    vec2 h = hash2(id + float(L) * 31.7);',
    '    if (h.x > density) continue;',
    // when the front passes this chip (a little jitter so chips arrive one by one, not in a straight line)
    '    float d = gp - s - (hash1(id * 9.1 + float(L)) - 0.5) * 0.08;',
    '    float chipA, flash;',
    '    if (reveal < 0.5) {',
    '      chipA = smoothstep(0.0, 0.025, d);',
    '      flash = exp(-pow((d - 0.02) / 0.03, 2.0));',
    '    } else {',
    '      float gone = d - LAG - 0.02;',            // chips linger after the base leaves, then wink out
    '      chipA = 1.0 - smoothstep(0.0, 0.05, gone);',
    '      flash = exp(-pow(gone / 0.03, 2.0));',
    '    }',
    '    if (chipA <= 0.0) continue;',
    '    float margin = 0.08 + 0.22 * h.y;',
    '    float twinkle = 0.5 + 0.5 * sin(TAU * (hash1(id * 7.7) + t * twinkleRate * (0.75 + 0.4 * hash1(id * 1.9))));',
    '    float kind = hash1(id * 5.3);',
    '    float clump = smoothstep(0.3, 0.75, vnoise((px + vec2(0.0, t * rise)) / (uShard * 5.0) + float(L) * 3.3));',
    '    bool isPale = kind < (0.212 + 0.54 * depth) * mix(0.4, 2.2, wave) * mix(0.25, 1.9, clump);',
    '    float glint = pow(twinkle, 7.0) * sheen * mix(0.6, 1.0, wave) * mix(0.35, 1.5, clump);',
    '    float whiteness = clamp((isPale ? 0.7 + 0.3 * twinkle : 0.0) + glint, 0.0, 1.0);',
    '    float spread = 0.06 * whiteness;',
    '    float soft = 1.9 / cell + 0.1 * whiteness;',
    '    float life = 0.5 + 0.5 * sin(TAU * (hash1(id * 4.1) + t * 3.0 * (0.8 + 0.4 * hash1(id * 2.3))));',
    '    float vis = smoothstep(0.102, 0.452, life);',
    '    float cover = smoothstep(margin - spread, margin - spread + soft, v.x) * vis;',
    '    if (cover <= 0.0) continue;',
    '    vec3 tint = holo(baseHue + (hash1(id * 3.1 + float(L)) - 0.5) * 0.08);',
    '    vec3 chip;',
    '    if (isPale) chip = mix(tint, vec3(1.0), clamp(shardPaleness * (1.3 + 0.3 * twinkle), 0.0, 1.0));',
    '    else if (kind < 0.6) chip = mix(tint, vec3(1.0), clamp(shardPaleness * (0.18 + 0.2 * twinkle), 0.0, 1.0));',
    '    else { float tl = dot(tint, vec3(0.299, 0.587, 0.114)); chip = mix(vec3(tl), tint, 1.15) * (0.82 + 0.1 * twinkle); }',
    '    chip = mix(chip, vec3(1.0, 0.97, 1.0), clamp(glint + flash * 0.85, 0.0, 0.95));',
    '    chip = mix(chip, vec3(1.0, 0.98, 1.0), clamp(wave * waveStrength * (0.55 + 0.45 * twinkle), 0.0, 0.95));',
    // over the base the chips blend like the shader; out in front of it they are the only thing there
    '    float ca = cover * chipA * mix(1.0, 0.5 + 0.5 * depth, baseA);',
    '    C = C * (1.0 - ca) + chip * ca;',
    '    A = A * (1.0 - ca) + ca;',
    '    hot = max(hot, cover * chipA * max(smoothstep(0.3, 1.0, glint), flash * 0.8) * mix(0.86, 1.0, depth));',
    '  }',
    '  if (A <= 0.0) return vec4(0.0);',
    '  vec3 col = C / A;',
    '  float luma = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(luma), col, saturation) * brightness;',
    '  col = mix(col, vec3(1.0), hot);',
    '  return vec4(clamp(col, 0.0, 1.0) * A, A);',
    '}',
    'void main() {',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  float a = sweepAngle * TAU / 360.0; vec2 dir = vec2(cos(a), sin(a));',
    '  float s = clamp(dot(px, dir) / dot(uRes, dir), 0.0, 1.0);',
    '  outColor = shimmerGate(px, uTime, uShard, uRise, uFrame, s, uP, uReveal);',
    '}'
  ].join('\n');

  function crystalTheme(apply, next) {
    var c = document.createElement('canvas');
    c.className = 'm-theme-curtain m-crystal';
    document.body.appendChild(c);
    var P = glPass(c, CRYSTAL_MAIN, BASE_UNIFORMS.concat([['uP', 'float'], ['uReveal', 'float']]), 2);
    if (!P) { c.remove(); return skyTheme(apply, next); }
    var gl = P.gl, U = P.U;
    var END = 1.24; // the front has to clear the far corner plus the base's lag
    var t0 = performance.now();

    function frame(p, reveal, now) {
      gl.uniform1f(U.uTime, (now - t0) / 1000 + 4);
      gl.uniform1f(U.uP, p);
      gl.uniform1f(U.uReveal, reveal);
      P.draw();
    }
    function run(dur, reveal) {
      return new Promise(function (res) {
        var start = performance.now();
        (function tick(now) {
          var k = Math.min(1, (now - start) / dur);
          var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          frame(e * END, reveal, now);
          if (k < 1) requestAnimationFrame(tick);
          else res();
        })(start);
      });
    }
    // a short beat of the full screen of shimmer before it dissolves
    function hold(ms) {
      return new Promise(function (res) {
        var start = performance.now();
        (function tick(now) {
          frame(END, 0, now);
          if (now - start < ms) requestAnimationFrame(tick);
          else res();
        })(start);
      });
    }

    themeBusy = true;
    frame(0, 0, t0);
    return run(620, 0).then(function () { return hold(140); }).then(function () {
      apply();
      return run(700, 1);
    }).then(function () {
      P.dispose();
      c.remove();
      themeBusy = false;
    });
  }

  // uniforms (declared by glPass): uLine.x where the line meets the bottom edge, uLine.y its lean
  // across the screen height, uBand half-width of the crystal band, uCell crystal size (all device px),
  // uCurtain: when .a is 1, everything ahead of the line (to its right) is filled with .rgb, so the
  // sweep reveals whatever is underneath
  var LINE_UNIFORMS = [['uLine', 'vec2'], ['uBand', 'float'], ['uCell', 'float'], ['uCurtain', 'vec4']];
  var LINE_MAIN = [
    'void main() {',
    '  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  vec2 B = vec2(uLine.x, uRes.y);',
    '  vec2 n = normalize(vec2(uRes.y, uLine.y));', // points to the new-theme side
    '  vec3 v = voronoi(px / uCell);',
    '  vec2 id = v.yz;',
    '  vec2 center = (id + hash2(id)) * uCell;',
    '  float h = hash1(id * 3.7);',
    '  float dc = dot(center - B, n);',
    '  vec4 base = vec4(0.0);',
    '  if (uCurtain.a > 0.5) { float k = smoothstep(-1.0, 1.0, dot(px - B, n)); base = vec4(uCurtain.rgb * k, k); }',
    '  float w = uBand * (0.55 + 0.45 * h);',
    '  float r = abs(dc) / w;',
    '  if (r >= 1.0) { outColor = base; return; }',
    '  float margin = mix(-0.05, 0.42, smoothstep(0.25, 1.0, r));', // solid at the line, breaking up at the edges
    '  float cover = smoothstep(margin, margin + 1.6 / uCell, v.x) * (1.0 - smoothstep(0.7, 1.0, r));', // edge chips fade, no popping
    '  if (cover <= 0.0) { outColor = base; return; }',
    '  vec3 col = shimmer(px, uTime, uShard, uRise, uFrame, 0.0, vec3(0.0), 0.0);',
    '  float core = exp(-pow(dc / (uBand * 0.18), 2.0));',
    '  float rim = 1.0 - smoothstep(margin, margin + 0.07, v.x);',
    '  col = mix(col, vec3(1.0, 0.97, 1.0), clamp(core * 0.45 + rim * 0.3, 0.0, 0.85));',
    '  outColor = vec4(col * cover, cover) + base * (1.0 - cover);',
    '}'
  ].join('\n');

  // The band's shader (the full shimmer) is slow to compile, and the browser only really compiles it on
  // first draw. Build it once while the page is idle and reuse it, so the first switch isn't the one
  // that stalls.
  var lineFx = null;
  function getLineFx() {
    if (lineFx) return lineFx;
    var c = document.createElement('canvas');
    c.className = 'm-line-band';
    var P = glPass(c, LINE_MAIN, BASE_UNIFORMS.concat(LINE_UNIFORMS), 2);
    if (!P) return null;
    lineFx = { c: c, P: P };
    return lineFx;
  }
  function warmLineFx() {
    if (reduce || !document.startViewTransition || !window.HOLO_LIB) return;
    var fx = getLineFx();
    if (!fx) return;
    fx.P.gl.uniform1f(fx.P.U.uTime, 4);
    fx.P.gl.uniform2f(fx.P.U.uLine, -99999, 0); // off-screen: nothing visible, but every code path runs
    fx.P.gl.uniform1f(fx.P.U.uBand, 95);
    fx.P.gl.uniform1f(fx.P.U.uCell, 26);
    fx.P.draw();
    fx.P.gl.finish(); // wait for the GPU so the compile is really done
  }

  /* ── the crystal line as an entrance ──
   * sweepReveal({ el, dur, band, cell }) covers `el` (or the whole screen) in its background colour and
   * sweeps the crystal band left to right across it, revealing what's underneath. Resolves when done.
   */
  function bgColour(el) {
    var c = getComputedStyle(el).backgroundColor;
    var m = c.match(/[\d.]+/g);
    if (!m || (m.length === 4 && +m[3] === 0)) {
      if (el !== document.body) return bgColour(document.body);
      return [1, 1, 1];
    }
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  function sweepReveal(o) {
    o = o || {};
    if (reduce || document.hidden || !window.HOLO_LIB) return Promise.resolve();
    var el = o.el || null;
    var c, P, own = !!el;
    if (el) {
      c = document.createElement('canvas');
      c.className = 'm-sweep-local';
      P = glPass(c, LINE_MAIN, BASE_UNIFORMS.concat(LINE_UNIFORMS), 2, function () {
        return { w: el.clientWidth, h: el.clientHeight };
      });
    } else {
      var fx = getLineFx();
      if (fx) { c = fx.c; P = fx.P; P.size(); }
    }
    if (!P) return Promise.resolve();

    var w = c.width / P.dpr, h = c.height / P.dpr;
    var band = o.band || 95, lean = h * 0.38;
    var from = -lean - band - 10, to = w + band + 10;
    var dur = o.dur || 1300;
    var bg = bgColour(el || document.body);
    P.gl.uniform1f(P.U.uBand, band * P.dpr);
    P.gl.uniform1f(P.U.uCell, (o.cell || 26) * P.dpr);
    P.gl.uniform4f(P.U.uCurtain, bg[0], bg[1], bg[2], 1);

    var t0 = performance.now();
    function place(sx, now) {
      P.gl.uniform1f(P.U.uTime, (now - t0) / 1000 + 4);
      P.gl.uniform2f(P.U.uLine, sx * P.dpr, lean * P.dpr);
      P.draw();
    }
    place(from, t0);
    (el || document.body).appendChild(c);
    if (o.onCovered) o.onCovered();

    return new Promise(function (res) {
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        place(from + (to - from) * e, now);
        if (k < 1) requestAnimationFrame(tick);
        else res();
      })(t0);
    }).then(function () {
      c.remove();
      P.gl.uniform4f(P.U.uCurtain, 0, 0, 0, 0);
      if (own) P.dispose();
    });
  }

  function lineTheme(apply, next) {
    if (!document.startViewTransition || !window.HOLO_LIB) { apply(); return Promise.resolve(); }
    var html = document.documentElement;
    var vw = window.innerWidth, vh = window.innerHeight;
    var lean = vh * 0.38;           // the line leans: its top is this far right of its bottom
    var from = -lean - 60, to = vw + 60;
    var DUR = 1300;

    var fx = getLineFx();
    if (!fx) { apply(); return Promise.resolve(); }

    // if the page intro is still playing, finish it now so both halves of the switch show the same page
    html.classList.remove('m-intro', 'm-intro-play');
    document.querySelectorAll('.m-rise, .m-wipe').forEach(function (el) {
      if (el.classList.contains('m-in')) el.classList.remove('m-rise', 'm-wipe', 'm-in');
    });
    var c = fx.c, P = fx.P;
    P.size();
    P.gl.uniform4f(P.U.uCurtain, 0, 0, 0, 0);
    P.gl.uniform1f(P.U.uBand, 95 * P.dpr);
    P.gl.uniform1f(P.U.uCell, 26 * P.dpr);

    // Split polygons for a layer whose top-left sits at (ox, oy) on screen. The line crosses the bottom of
    // the screen at sx and leans right by `lean` toward the top; it's extended far past the screen so it
    // also cuts layers taller than the viewport (the page content).
    function halves(sx, ox, oy) {
      var Y0 = -20000, Y1 = 20000, slope = lean / vh;
      var xa = sx + lean - slope * Y0 - ox, xb = sx + lean - slope * Y1 - ox;
      var ya = Y0 - oy, yb = Y1 - oy;
      return {
        left: 'polygon(-99999px ' + ya + 'px, ' + xa + 'px ' + ya + 'px, ' + xb + 'px ' + yb + 'px, -99999px ' + yb + 'px)',
        right: 'polygon(' + xa + 'px ' + ya + 'px, 99999px ' + ya + 'px, 99999px ' + yb + 'px, ' + xb + 'px ' + yb + 'px)'
      };
    }

    // one function moves the theme edge on every layer and the crystal band together,
    // so nothing can drift apart
    var t0 = 0;
    function place(sx, now) {
      html.style.setProperty('--vt-new-root', halves(sx, 0, 0).left);
      P.gl.uniform1f(P.U.uTime, (now - t0) / 1000 + 4);
      P.gl.uniform2f(P.U.uLine, sx * P.dpr, lean * P.dpr);
      P.draw();
    }
    place(from, performance.now());

    themeBusy = true;
    html.classList.add('vt-line');
    var vt = document.startViewTransition(function () {
      apply();
      document.body.appendChild(c);
    });
    vt.ready.then(function () {
      // keeps the transition open for DUR; the actual movement is driven by place() below
      html.animate({ opacity: [1, 1] }, { duration: DUR, pseudoElement: '::view-transition-new(root)' });
      t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / DUR);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        place(from + (to - from) * e, now);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }).catch(function () {});
    return vt.finished.catch(function () {}).then(function () {
      c.remove(); // kept for next time
      html.classList.remove('vt-line');
      html.style.removeProperty('--vt-new-root');
      themeBusy = false;
    });
  }

  /*
   * The theme button runs the crystal line (lineTheme). The sunrise/sunset curtain (skyTheme) and the
   * full-screen crystallize (crystalTheme) are kept but not wired to any button; they're reachable as
   * window.motion.themeEffects if you want to bring one back.
   * lineTheme needs view transitions; without them the theme just switches instantly.
   */
  function wrapTheme() {
    var original = window.toggleTheme;
    if (typeof original !== 'function' || original.__motion) return;
    var wrapped = function () {
      if (themeBusy) return;
      if (reduce || document.hidden || !document.startViewTransition || !window.HOLO_LIB) return original();
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      lineTheme(original, next);
    };
    wrapped.__motion = true;
    window.toggleTheme = wrapped;
  }

  window.motion = {
    enter: enter,
    transition: transition,
    leaveMs: LEAVE_MS,
    themeEffects: { sky: skyTheme, crystal: crystalTheme, line: lineTheme }, // not on any button (see wrapTheme)
    sweepReveal: sweepReveal
  };

  function boot() {
    wrapTheme();
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); };
    var warm = function () { idle(warmLineFx, { timeout: 3000 }); };
    if (document.readyState === 'complete') warm();
    else window.addEventListener('load', warm);
    var main = document.querySelector('main');
    var html = document.documentElement;
    var covered = html.classList.contains('m-cover'); // set in index.html's <head> before first paint
    if (!main || reduce || document.hidden) { html.classList.remove('m-cover'); return; }
    if (covered && main.classList.contains('landing')) {
      sweepReveal({ onCovered: function () { html.classList.remove('m-cover'); } })
        .then(function () { html.classList.remove('m-cover'); });
      enter(main, 0);
      return;
    }
    html.classList.remove('m-cover');
    if (main.classList.contains('landing') && !window.location.hash) intro(main);
    else enter(main, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
