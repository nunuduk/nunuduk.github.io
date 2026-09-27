(function () {
  /*
   * Sound design, synthesized with Web Audio (no sound files).
   *   crystalSweep(dur, next): the theme switch. Glass tinks ring out as the crystal band crosses the
   *     screen, panned left to right with it, over a thin airy shimmer, in a small generated room; a soft
   *     glassy settle at the end. Going dark sits a little lower and darker, going light a little higher.
   *   landing(dur, theme): the same on the landing sweep, but only if the browser lets the page make sound
   *     before any click (usually it doesn't; then it stays silent rather than playing late).
   *   photoTick(): the about photo's swap, a quick sparkle of the same glass: five short tinks running up
   *     in about 0.2s, higher, and muffled (lowpassed, quieter).
   * Browsers only allow sound after the visitor has interacted with the page, so the audio wakes on the
   * first click or key press; until then the photo swaps are silent. Switched off from ⌘K ("toggle sound";
   * remembered in this browser).
   */
  var ctx = null, out = null, room = null, muffled = null;

  function enabled() {
    try { return localStorage.getItem('sfx') !== '0'; } catch (e) { return true; }
  }

  // create or wake the audio context; only works inside a click or key handler
  function prime() {
    if (!enabled()) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      out = ctx.createDynamicsCompressor();
      out.threshold.value = -18;
      out.ratio.value = 4;
      var master = ctx.createGain();
      master.gain.value = 1.25; // peaks around -12 dBFS: present, but a gentle UI sound
      out.connect(master);
      master.connect(ctx.destination);
      // the room: a short stereo tail of decaying noise, brighter at the start
      room = ctx.createConvolver();
      var len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      room.buffer = ir;
      var wet = ctx.createGain();
      wet.gain.value = 0.32;
      room.connect(wet);
      wet.connect(out);
      // the muffled bus for the photo swaps: through a lowpass, a bit quieter
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      lp.Q.value = 0.5;
      muffled = ctx.createGain();
      muffled.gain.value = 1;
      muffled.connect(lp);
      lp.connect(out);
      lp.connect(room);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // the theme switch's own bus: a gentle lowpass takes the edge off the top, and it sits about 30% quieter
  var themeBus = null;
  function themeOut() {
    if (!themeBus) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      lp.Q.value = 0.4;
      var g = ctx.createGain();
      g.gain.value = 0.58; // about 3 dB (30%) under where it was
      lp.connect(g);
      g.connect(out);
      g.connect(room);
      themeBus = lp;
    }
    return themeBus;
  }
  // wake the audio on the first interaction, so sounds that aren't started by a click (the photo swap) can play
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function wake() { if (enabled()) prime(); }, { capture: true, passive: true });
  });

  // a voice's path out: panned, into the main output and the room, or into the muffled bus
  function voiceOut(pan, bus) {
    var p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = Math.max(-1, Math.min(1, pan));
    if (bus) p.connect(bus);
    else { p.connect(out); p.connect(room); }
    return p;
  }

  // one struck piece of glass. What makes it glass: overtones at uneven ratios (not a bell's or a string's),
  // the main tone doubled a few Hz apart so it shimmers as it rings, and a bright noise clink at the strike.
  var PARTIALS = [ // ratio, level, share of the decay
    [1, 1, 1], [1.0035, 0.75, 1], [2.32, 0.34, 0.6], [4.25, 0.16, 0.35], [6.63, 0.07, 0.2]
  ];
  var noiseBuf = null;
  function tink(t, f, vel, pan, decay, bus) {
    var dest = voiceOut(pan, bus);
    PARTIALS.forEach(function (p) {
      var hz = f * p[0];
      if (hz > 18000) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), d = decay * p[2];
      o.type = 'sine';
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.062 * vel * p[1], t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + d + 0.05);
    });
    // the clink: 12ms of bright noise
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    var n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf;
    hp.type = 'highpass';
    hp.frequency.value = Math.min(9000, f * 3);
    ng.gain.setValueAtTime(0.05 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(dest);
    n.start(t);
    n.stop(t + 0.03);
  }

  var ease = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }; // the band's easing
  var STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // major pentatonic, two octaves

  // The theme switch: glass tinks ring out as the crystal band crosses the screen, panned with it, over a thin
  // airy shimmer; two long glass tones settle at the end. Going dark sits lower, going light higher.
  // Everything goes through themeOut(): softened at the top and about 30% quieter.
  function crystalSweep(dur, next) {
    if (!prime()) return;
    var s = (dur || 1300) / 1000, t0 = ctx.currentTime + 0.02;
    var dark = next === 'dark';
    var base = dark ? 659.25 : 987.77; // E5 for dark, B5 for light
    function note(i) { return base * Math.pow(2, STEPS[i % STEPS.length] / 12); }

    // the tinks follow the band: denser where it moves fastest, panned to where it is
    var n = 30;
    for (var i = 0; i < n; i++) {
      var k = (i + Math.random() * 0.8) / n;              // time through the sweep
      var x = ease(k);                                     // where the band is, 0..1 across
      var idx = Math.floor(Math.random() * 7);
      if (!dark) idx = Math.min(STEPS.length - 1, idx + Math.round(x * 3)); // light: rises as it goes
      else idx = Math.max(0, idx - Math.round(x * 3));                      // dark: settles as it goes
      var vel = 0.35 + 0.65 * Math.random() * (0.6 + 0.4 * Math.sin(Math.PI * k));
      tink(t0 + k * s, note(idx), vel, x * 1.8 - 0.9 + (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.9, themeOut());
    }

    // shimmer: filtered noise swelling in and out, its brightness and pan riding the band
    var len = Math.floor(ctx.sampleRate * (s + 0.6)), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var nd = buf.getChannelData(0);
    for (var j = 0; j < len; j++) nd[j] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.Q.value = 2;
    var steps2 = 24, freqs = new Float32Array(steps2), pans = new Float32Array(steps2);
    for (var q = 0; q < steps2; q++) {
      var e = ease(q / (steps2 - 1));
      freqs[q] = (dark ? 3000 : 4000) + e * (dark ? 1800 : 2600);
      pans[q] = e * 1.6 - 0.8;
    }
    bp.frequency.setValueCurveAtTime(freqs, t0, s);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.035, t0 + s * 0.3);
    g.gain.setValueAtTime(0.035, t0 + s * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + s + 0.5);
    var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp);
    bp.connect(g);
    if (pn) { pn.pan.setValueCurveAtTime(pans, t0, s); g.connect(pn); pn.connect(themeOut()); }
    else g.connect(themeOut());
    src.start(t0);
    src.stop(t0 + s + 0.6);

    // the settle: two long glass tones a fifth apart as the band leaves the screen
    var end = t0 + s * 0.92;
    tink(end, base / 2, 0.6, 0.5, 2.2, themeOut());
    tink(end + 0.06, base * 0.75, 0.45, 0.7, 2, themeOut());
  }

  // the photo swap: a quick glass sparkle, five short tinks running up in about 0.2s, high and muffled
  function photoTick() {
    if (!enabled() || !ctx || ctx.state !== 'running') return; // silent until the visitor has interacted
    var t0 = ctx.currentTime + 0.02, base = 2637; // E7
    var start = Math.floor(Math.random() * 3);
    for (var i = 0; i < 5; i++) {
      tink(t0 + i * 0.038 + Math.random() * 0.008, base * Math.pow(2, STEPS[start + i] / 12),
        0.5 + Math.random() * 0.4, -0.3 + i * 0.15, 0.12 + Math.random() * 0.1, muffled);
    }
  }

  // The landing sweep has no click to unlock audio. Try; if the browser hasn't let it start within a moment,
  // give up, so it never plays late (e.g. on the visitor's first click).
  function landing(dur, theme) {
    if (!enabled()) return;
    var c = prime();
    if (!c) return;
    var asked = performance.now();
    var go = function () { if (c.state === 'running' && performance.now() - asked < 250) crystalSweep(dur, theme); };
    if (c.state === 'running') go();
    else if (c.resume) c.resume().then(go, function () {});
  }

  window.sfx = {
    prime: prime,
    landing: landing,
    crystalSweep: crystalSweep,
    photoTick: photoTick,
    enabled: enabled,
    toggle: function () {
      var on = !enabled();
      try { localStorage.setItem('sfx', on ? '1' : '0'); } catch (e) {}
      if (on) prime();
      return on;
    }
  };
})();
