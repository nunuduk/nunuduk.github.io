(function () {
  /*
   * Crystal storm: small glass shards fizzling up behind the page, in the Ritsu Shimmer style.
   *   colour   the shader's 20-stop palette, sampled from the same 41.8° rainbow sweep, so neighbouring
   *            shards share a hue and the colours drift over time like the shader's bands
   *   shards   irregular 5–6-sided chips in the shader's three kinds: pale foil, mid tint, deep glass
   *   motion   rise with a sway and a slow spin, trailing a dotted line of tiny shards (each its own
   *            shape), shrinking and fading toward the tail; a glint every second or two, when a curved
   *            four-point sparkle grows and fades with it; in dark mode each shard also casts a soft glow
   *            in its colour that breathes with the twinkle; at the end of its life a shard shrinks away
   *            into a few flickering sparks
   * One 2D canvas, 8–24 shards (each with a 6-dot trail) per frame. Paused while the tab is hidden, off
   * under reduced motion, and switchable from ⌘K ("toggle crystals"; the choice is remembered in this browser).
   */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STOPS = [
    [0.8337, 0.3580, 0.7086], [0.8349, 0.3494, 0.8105], [0.9192, 0.3398, 0.9300], [0.9067, 0.3304, 0.9507],
    [0.6761, 0.3228, 0.9597], [0.4930, 0.2396, 0.9672], [0.3675, 0.2346, 0.9660], [0.2979, 0.3798, 0.9644],
    [0.2616, 0.4883, 0.9723], [0.2921, 0.6630, 0.9874], [0.3160, 0.8321, 0.9963], [0.2766, 0.8566, 0.9755],
    [0.2497, 0.8375, 0.8719], [0.3384, 0.8891, 0.8264], [0.4029, 0.9171, 0.8840], [0.4017, 0.9442, 0.7516],
    [0.6308, 0.9925, 0.6860], [0.9226, 0.9749, 0.7033], [0.8734, 0.6812, 0.7194], [0.8466, 0.4564, 0.6598]
  ];
  var SWEEP = 41.8 * Math.PI / 180, DIR_X = Math.cos(SWEEP), DIR_Y = Math.sin(SWEEP);
  var DOTS = 6;            // trail units per shard
  var GAP = 5;             // positions between units (~1/12 s at 60 fps)
  var TRAIL = DOTS * GAP + 1;

  function holo(h) {
    var x = (h - Math.floor(h)) * 20, i = Math.floor(x) % 20, j = (i + 1) % 20, f = x - Math.floor(x);
    f = f * f * (3 - 2 * f);
    var a = STOPS[i], b = STOPS[j];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  function enabled() {
    try { return localStorage.getItem('crystals') !== '0'; } catch (e) { return true; }
  }

  var canvas = document.createElement('canvas');
  canvas.className = 'crystal-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  var shards = [], sparks = [];
  var raf = 0, last = 0, t = 0, on = enabled();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function target() { return Math.max(8, Math.min(24, Math.round(W * H / 60000))); }

  function spawn(anywhere) {
    var size = 2.5 + Math.pow(Math.random(), 1.8) * 7.5; // mostly small, a few bigger
    var n = Math.random() < 0.5 ? 5 : 6, verts = [];
    for (var k = 0; k < n; k++) {
      var ang = (k / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      var r = size * (0.55 + Math.random() * 0.6);
      verts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    // the dotted trail: each dot is its own tiny chip with its own shape, spin and hue
    var dots = [];
    for (var d = 0; d < DOTS; d++) {
      var m = 4 + Math.floor(Math.random() * 3), dv = [];
      for (var e = 0; e < m; e++) {
        var da = (e / m) * Math.PI * 2 + (Math.random() - 0.5) * 1.1;
        var dr = 0.55 + Math.random() * 0.6;
        dv.push([Math.cos(da) * dr, Math.sin(da) * dr]);
      }
      dots.push({ verts: dv, rot: Math.random() * 6.28, hue: (Math.random() - 0.5) * 0.12 });
    }
    var kind = Math.random();
    return {
      dots: dots,
      x: Math.random() * W,
      // they appear anywhere, rise a little and fizzle out, so the whole screen sparkles
      y: Math.random() * (H + 30),
      vy: -(45 + Math.random() * 75) * (0.7 + size / 12), // bigger shards rise faster, like near layers
      sway: 10 + Math.random() * 22,
      swayRate: 0.25 + Math.random() * 0.5,
      swayPhase: Math.random() * 6.28,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 1.2,
      verts: verts,
      size: size,
      hueJitter: (Math.random() - 0.5) * 0.08,
      kind: kind < 0.3 ? 'pale' : kind < 0.65 ? 'mid' : 'deep',
      twPhase: Math.random(),
      twRate: 0.35 + Math.random() * 0.6, // an occasional glint, not a constant flicker
      sparkRot: (Math.random() - 0.5) * 0.5,
      age: anywhere ? Math.random() * 1.5 : 0, // the first batch starts mid-life so the screen isn't empty
      life: 2 + Math.random() * 3,
      hist: [], // recent positions, newest last: the trail
      x0: 0
    };
  }

  function fill() {
    while (shards.length < target()) {
      var s = spawn(t < 0.1);
      s.x0 = s.x;
      shards.push(s);
    }
  }

  function fizzle(s, x, y) {
    var count = 2 + Math.floor(Math.random() * 3);
    for (var k = 0; k < count; k++) {
      sparks.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 40,
        vy: -10 - Math.random() * 30,
        age: 0,
        life: 0.35 + Math.random() * 0.45,
        hue: s.hueJitter
      });
    }
  }

  function colourAt(x, y, jitter) {
    var h = ((x * DIR_X + y * DIR_Y) / H) * 0.69 - t * 0.425 + 0.729 + jitter;
    return holo(h);
  }

  function rgb(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + a + ')';
  }


  // one small polygon (unit-radius verts) at x, y
  function chip(verts, x, y, rot, scale, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.beginPath();
    for (var v = 0; v < verts.length; v++) {
      var p = verts[v];
      if (v) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  // four-point sparkle (✦): curved, tapering points; `pinch` sets how thin they are
  function starPath(r, pinch) {
    var k = r * pinch;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.closePath();
  }

  // a twinkle: main sparkle, a smaller diagonal one behind it, and a bright core. It grows and shrinks
  // with the glint instead of popping on. Dark: white light. Light: the shard's colour with a white core.
  function sparkle(x, y, r, a, rot, colour, dark) {
    if (r < 0.6 || a < 0.02) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = dark ? 'rgba(255,255,255,' + a + ')' : rgb(colour, a * 0.9);
    starPath(r, dark ? 0.1 : 0.08);
    ctx.fill();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = dark ? 'rgba(255,255,255,' + a * 0.45 + ')' : rgb(colour, a * 0.4);
    starPath(r * 0.5, 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.6, r * 0.12), 0, 6.283);
    ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, a * 1.2) + ')';
    ctx.fill();
    ctx.restore();
  }

  // dark mode: a soft glow in the shard's colour, as if it lit the dark around it
  function halo(x, y, r, c, a) {
    if (a < 0.01) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgb(c, a));
    g.addColorStop(0.35, rgb(c, a * 0.35));
    g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function frame(now) {
    raf = 0;
    if (!on) return;
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    t += dt;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // glass adds light on a dark page; on a white page it has to sit on top normally
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    for (var i = shards.length - 1; i >= 0; i--) {
      var s = shards[i];
      s.age += dt;
      s.y += s.vy * dt;
      s.rot += s.vr * dt;
      var x = s.x0 + Math.sin(s.swayPhase + s.age * s.swayRate * 6.28) * s.sway;
      var k = s.age / s.life;
      if (k >= 1 || s.y < -20) {
        if (k >= 1) fizzle(s, x, s.y);
        shards.splice(i, 1);
        continue;
      }
      var fadeIn = Math.min(1, s.age / 0.6);
      var fizz = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1; // shrink away at the end
      var tw = 0.5 + 0.5 * Math.sin(6.28 * (s.twPhase + s.age * s.twRate));
      var glint = Math.pow(tw, 14); // short, sharp peak

      var c = colourAt(x, s.y, s.hueJitter);
      // pale foil vanishes on a white page, so in light mode those shards keep their colour
      if (s.kind === 'pale' && dark) c = [c[0] + (1 - c[0]) * 0.55, c[1] + (1 - c[1]) * 0.55, c[2] + (1 - c[2]) * 0.55];
      else if (s.kind === 'deep') c = [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78];
      var base = c;
      c = [c[0] + (1 - c[0]) * glint * 0.7, c[1] + (1 - c[1]) * glint * 0.7, c[2] + (1 - c[2]) * glint * 0.7];
      var alpha = fadeIn * (dark ? 0.8 : 0.9) * (0.8 + 0.2 * tw);

      // ambient glow in the dark: always a little, breathing with the twinkle, blooming at the peak
      if (dark) halo(x, s.y, s.size * (3 + glint * 2.5), base, alpha * fizz * (0.09 + 0.06 * tw + glint * 0.18));

      // trail: a dotted line of tiny shards along the recent path, shrinking and fading toward the tail
      s.hist.push(x, s.y);
      if (s.hist.length > TRAIL * 2) s.hist.splice(0, 2);
      var hn = s.hist.length / 2;
      for (var dI = 0; dI < DOTS; dI++) {
        var back = (dI + 1) * GAP;       // how many positions behind the shard
        var hi = hn - 1 - back;
        if (hi < 0) break;
        var f = 1 - (dI + 1) / (DOTS + 1); // 1 near the shard, 0 at the tail
        var dot = s.dots[dI];
        var dc = colourAt(s.hist[hi * 2], s.hist[hi * 2 + 1], s.hueJitter + dot.hue);
        if (dark) dc = [dc[0] + (1 - dc[0]) * 0.3, dc[1] + (1 - dc[1]) * 0.3, dc[2] + (1 - dc[2]) * 0.3];
        var dx = s.hist[hi * 2], dy = s.hist[hi * 2 + 1], da = alpha * (0.2 + 0.6 * f);
        if (dark) halo(dx, dy, s.size * (0.9 + 1.2 * f), dc, da * 0.12);
        chip(dot.verts, dx, dy, dot.rot + s.rot * 0.5, s.size * (0.25 + 0.4 * f) * fizz, rgb(dc, da));
      }

      ctx.save();
      ctx.translate(x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(fizz, fizz);
      ctx.beginPath();
      for (var v = 0; v < s.verts.length; v++) {
        var p = s.verts[v];
        if (v) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = rgb(c, alpha);
      ctx.fill();
      // a bright facet edge, like light catching the glass
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + glint * 0.6) * alpha + ')';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();

      // sparkle: grows with the glint (no threshold pop). On white it stays smaller and lighter so it
      // reads as a glint, not a blot.
      if (dark) sparkle(x, s.y, s.size * (0.8 + glint * 1.5) * fizz, glint * alpha * 0.7, s.sparkRot, base, true);
      else sparkle(x, s.y, s.size * (0.7 + glint * 0.9) * fizz, glint * alpha * 0.5, s.sparkRot, base, false);
    }

    for (var j = sparks.length - 1; j >= 0; j--) {
      var p2 = sparks[j];
      p2.age += dt;
      if (p2.age >= p2.life) { sparks.splice(j, 1); continue; }
      p2.x += p2.vx * dt;
      p2.y += p2.vy * dt;
      var a2 = (1 - p2.age / p2.life) * (Math.random() < 0.7 ? 1 : 0.3); // flicker
      var c2 = colourAt(p2.x, p2.y, p2.hue);
      ctx.fillStyle = rgb([c2[0] + (1 - c2[0]) * 0.5, c2[1] + (1 - c2[1]) * 0.5, c2[2] + (1 - c2[2]) * 0.5], a2);
      ctx.fillRect(p2.x - 1, p2.y - 1, 2, 2);
    }

    fill();
    schedule();
  }

  function schedule() {
    if (!raf && on && !document.hidden) raf = requestAnimationFrame(frame);
  }

  // the sidebar's "crystals on / off" button
  function label() {
    document.querySelectorAll('[data-crystals-toggle]').forEach(function (b) {
      b.textContent = on ? 'crystals on' : 'crystals off';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-crystals-toggle]')) setOn(!on);
  });

  function setOn(v) {
    on = v;
    try { localStorage.setItem('crystals', v ? '1' : '0'); } catch (e) {}
    canvas.hidden = !v;
    label();
    if (v) { last = 0; schedule(); }
    else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  resize();
  canvas.hidden = !on;
  label();
  fill();
  schedule();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', function () { last = 0; schedule(); });

  window.crystals = {
    toggle: function () { setOn(!on); return on; },
    isOn: function () { return on; }
  };
})();
