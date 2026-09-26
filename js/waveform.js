(function () {
  /* Timeline drawn as a waveform viewer. Time unit = months since Jan 2022. */
  var START_YEAR = 2022;
  var SPAN = 120; // Jan 2022 → Dec 2031
  var ROW_H = 34;
  var AXIS_H = 26;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function m(y, mo) { return (y - START_YEAR) * 12 + (mo - 1); }

  var NOW = (function () {
    var d = new Date();
    var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var t = m(d.getFullYear(), d.getMonth() + 1) + (d.getDate() - 1) / dim;
    return Math.max(0, Math.min(SPAN, t));
  })();

  var PHASES = ['charge', 'hold', 'recover', 'wait'];

  var SIGNALS = [
    { name: 'sem_clk', type: 'clk', note: 'one period per school year' },
    { name: 'vpc', type: 'power', note: '4-phase adiabatic power clock' },
    { name: 'school[1:0]', type: 'bus', segs: [
      [m(2022, 8), m(2026, 5), 'ND · B.S. EE'],
      [m(2026, 8), SPAN, 'UMich · Ph.D. ECE']
    ] },
    { name: 'research[3:0]', type: 'bus', segs: [
      [m(2024, 1), m(2024, 8), 'FPGA test harness'],
      [m(2024, 8), m(2025, 4), 'adiabatic MIPS impl.'],
      [m(2025, 5), m(2026, 5), 'adiabatic verification · UVM'],
      [m(2026, 8), NOW, 'power feedback in the design flow'],
      [NOW, SPAN, 'x', 'x']
    ] },
    { name: 'vcd', type: 'bus', segs: [
      [m(2022, 8), m(2026, 5), 'Strike Magazine · merch · campaigns']
    ] },
    { name: 'mentor', type: 'bit', high: [[m(2024, 8), m(2026, 5)]] },
    { name: 'tapeout', type: 'pulse', events: [
      [m(2024, 6), 'Fan Speed Controller ASIC · GF180'],
      [m(2025, 6), 'Full-Duplex UART · TSMC 180nm']
    ] },
    { name: 'pub', type: 'pulse', events: [
      [m(2025, 6), 'A Verification Framework for Adiabatic Processors']
    ] }
  ];

  function fmt(t) {
    var mi = Math.floor(t);
    return MONTHS[((mi % 12) + 12) % 12] + ' ' + (START_YEAR + Math.floor(mi / 12));
  }

  function fmtDelta(d) {
    d = Math.round(Math.abs(d));
    var y = Math.floor(d / 12), mo = d % 12;
    if (!y) return mo + 'm';
    return y + 'y ' + mo + 'm';
  }

  function valueAt(sig, t) {
    var i;
    switch (sig.type) {
      case 'clk': {
        var mo = ((Math.floor(t) % 12) + 12) % 12;
        return mo >= 6 ? '1 · fall' : '0 · spring';
      }
      case 'power':
        return PHASES[Math.floor(t) % 4];
      case 'bus':
        for (i = 0; i < sig.segs.length; i++) {
          var s = sig.segs[i];
          if (t >= s[0] && t < s[1]) return s[3] === 'x' ? 'x · unknown' : s[2];
        }
        return 'z';
      case 'bit':
        for (i = 0; i < sig.high.length; i++) {
          if (t >= sig.high[i][0] && t < sig.high[i][1]) return '1';
        }
        return '0';
      case 'pulse':
        for (i = 0; i < sig.events.length; i++) {
          if (Math.floor(t) === sig.events[i][0]) return sig.events[i][1];
        }
        return '0';
    }
    return '';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildSvg(pxm) {
    var W = SPAN * pxm;
    var H = AXIS_H + SIGNALS.length * ROW_H + 4;
    var out = [];
    out.push('<svg class="wf-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
    out.push('<defs><pattern id="wf-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<line class="wf-hatch" x1="0" y1="0" x2="0" y2="5"/></pattern></defs>');

    // grid + axis
    for (var mo = 0; mo <= SPAN; mo++) {
      var x = Math.round(mo * pxm) + 0.5;
      if (mo % 12 === 0) {
        out.push('<line class="wf-grid-year" x1="' + x + '" y1="' + (AXIS_H - 8) + '" x2="' + x + '" y2="' + H + '"/>');
        if (mo < SPAN) out.push('<text class="wf-axis" x="' + (x + 4) + '" y="' + (AXIS_H - 12) + '">' + (START_YEAR + mo / 12) + '</text>');
      } else if (pxm >= 8) {
        out.push('<line class="wf-tick" x1="' + x + '" y1="' + (AXIS_H - 4) + '" x2="' + x + '" y2="' + AXIS_H + '"/>');
      }
    }
    out.push('<line class="wf-axis-line" x1="0" y1="' + AXIS_H + '" x2="' + W + '" y2="' + AXIS_H + '"/>');

    SIGNALS.forEach(function (sig, r) {
      var top = AXIS_H + r * ROW_H + 8;
      var bot = top + ROW_H - 16;
      var mid = (top + bot) / 2;
      var d = '', i, x0, x1;

      if (sig.type === 'clk') {
        for (i = 0; i < SPAN; i += 6) {
          var hi = (i % 12) >= 6;
          var y = hi ? top : bot;
          x0 = i * pxm; x1 = (i + 6) * pxm;
          d += (i === 0 ? 'M' : 'L') + x0 + ' ' + y + ' L' + x1 + ' ' + y;
        }
        out.push('<path class="wf-trace" d="' + d + '"/>');
      } else if (sig.type === 'power') {
        // trapezoid: ramp up, hold, ramp down, wait — one month each
        for (i = 0; i < SPAN; i += 4) {
          x0 = i * pxm;
          d += (i === 0 ? 'M' + x0 + ' ' + bot : '') +
            ' L' + (x0 + pxm) + ' ' + top +
            ' L' + (x0 + 2 * pxm) + ' ' + top +
            ' L' + (x0 + 3 * pxm) + ' ' + bot +
            ' L' + (x0 + 4 * pxm) + ' ' + bot;
        }
        out.push('<path class="wf-trace wf-analog" d="' + d + '"/>');
      } else if (sig.type === 'bit') {
        var level = bot, last = 0;
        d = 'M0 ' + bot;
        sig.high.forEach(function (h) {
          d += ' L' + h[0] * pxm + ' ' + bot + ' L' + h[0] * pxm + ' ' + top + ' L' + h[1] * pxm + ' ' + top + ' L' + h[1] * pxm + ' ' + bot;
          last = h[1];
        });
        d += ' L' + SPAN * pxm + ' ' + level;
        out.push('<path class="wf-trace" d="' + d + '"/>');
      } else if (sig.type === 'pulse') {
        d = 'M0 ' + bot;
        sig.events.forEach(function (e) {
          var ex = e[0] * pxm, ew = Math.max(pxm, 3);
          d += ' L' + ex + ' ' + bot + ' L' + ex + ' ' + top + ' L' + (ex + ew) + ' ' + top + ' L' + (ex + ew) + ' ' + bot;
        });
        d += ' L' + SPAN * pxm + ' ' + bot;
        out.push('<path class="wf-trace" d="' + d + '"/>');
      } else if (sig.type === 'bus') {
        // high-Z line everywhere, buses drawn on top
        var cursorX = 0;
        sig.segs.forEach(function (s) {
          if (s[0] * pxm > cursorX) {
            out.push('<line class="wf-z" x1="' + cursorX + '" y1="' + mid + '" x2="' + s[0] * pxm + '" y2="' + mid + '"/>');
          }
          x0 = s[0] * pxm; x1 = s[1] * pxm;
          var k = Math.min(4, (x1 - x0) / 2);
          var poly = x0 + ',' + mid + ' ' + (x0 + k) + ',' + top + ' ' + (x1 - k) + ',' + top + ' ' +
            x1 + ',' + mid + ' ' + (x1 - k) + ',' + bot + ' ' + (x0 + k) + ',' + bot;
          if (s[3] === 'x') {
            out.push('<polygon class="wf-bus wf-x" points="' + poly + '"/>');
          } else {
            out.push('<polygon class="wf-bus" points="' + poly + '"/>');
            var clipId = 'c' + r + '_' + Math.round(s[0]);
            out.push('<clipPath id="' + clipId + '"><rect x="' + (x0 + k) + '" y="' + top + '" width="' + Math.max(0, x1 - x0 - 2 * k) + '" height="' + (bot - top) + '"/></clipPath>');
            out.push('<text class="wf-bus-label" clip-path="url(#' + clipId + ')" data-x0="' + (x0 + k + 4) + '" x="' + (x0 + k + 4) + '" y="' + (mid + 3.5) + '">' + esc(s[2]) + '</text>');
          }
          cursorX = x1;
        });
        if (cursorX < SPAN * pxm) {
          out.push('<line class="wf-z" x1="' + cursorX + '" y1="' + mid + '" x2="' + SPAN * pxm + '" y2="' + mid + '"/>');
        }
      }
    });

    // now marker
    var nx = NOW * pxm;
    out.push('<line class="wf-now" x1="' + nx + '" y1="' + (AXIS_H - 8) + '" x2="' + nx + '" y2="' + H + '"/>');
    out.push('<text class="wf-now-label" x="' + (nx - 4) + '" y="' + (AXIS_H - 12) + '" text-anchor="end">now</text>');

    out.push('<line class="wf-marker" id="wf-marker" x1="-10" y1="' + AXIS_H + '" x2="-10" y2="' + H + '"/>');
    out.push('<line class="wf-cursor" id="wf-cursor" x1="-10" y1="0" x2="-10" y2="' + H + '"/>');
    out.push('</svg>');
    return out.join('');
  }

  function initWaveform() {
    var root = document.getElementById('waveform');
    if (!root || root.dataset.wfReady) return;
    root.dataset.wfReady = '1';

    var namesEl = root.querySelector('.wf-names');
    var scrollEl = root.querySelector('.wf-scroll');
    var readCursor = document.getElementById('wf-read-cursor');
    var readMarker = document.getElementById('wf-read-marker');
    var readDelta = document.getElementById('wf-read-delta');

    var pxm = 12;
    var cursor = NOW + 0.5;
    var marker = null;

    namesEl.innerHTML = '<div class="wf-names-head"><span>signal</span><span>value @ cursor</span></div>' +
      SIGNALS.map(function (s, i) {
        return '<div class="wf-row" title="' + esc(s.note || '') + '"><span class="wf-name">' + esc(s.name) +
          '</span><span class="wf-val" data-i="' + i + '"></span></div>';
      }).join('');
    var valEls = namesEl.querySelectorAll('.wf-val');

    function render() {
      scrollEl.innerHTML = buildSvg(pxm);
      labels = scrollEl.querySelectorAll('.wf-bus-label');
      pinLabels();
      update();
      syncBar();
    }

    /* overview scrollbar: the whole timeline in miniature, with a thumb for the stretch in view */
    var track = root.querySelector('.wf-track');
    var thumb = root.querySelector('.wf-thumb');
    var tCursor = root.querySelector('.wf-track-cursor');
    var tMarker = root.querySelector('.wf-track-marker');
    (function drawMarks() {
      var html = '';
      for (var mo = 0; mo <= SPAN; mo += 12) {
        var pct = (mo / SPAN) * 100;
        html += '<span class="wf-track-year" style="left:' + pct + '%">' +
          (mo < SPAN ? '<i>' + String(START_YEAR + mo / 12).slice(2) + '</i>' : '') + '</span>';
      }
      html += '<span class="wf-track-now" style="left:' + (NOW / SPAN) * 100 + '%"></span>';
      track.querySelector('.wf-track-marks').innerHTML = html;
    })();

    function syncBar() {
      var sw = scrollEl.scrollWidth, cw = scrollEl.clientWidth;
      var frac = sw > 0 ? Math.min(1, cw / sw) : 1;
      var left = sw > cw ? scrollEl.scrollLeft / sw : 0;
      thumb.style.left = left * 100 + '%';
      thumb.style.width = frac * 100 + '%';
      track.setAttribute('aria-valuenow', Math.round(left * 100));
      tCursor.style.left = (cursor / SPAN) * 100 + '%';
      tMarker.hidden = marker === null;
      if (marker !== null) tMarker.style.left = (marker / SPAN) * 100 + '%';
    }

    function scrollToFrac(f, smooth) {
      var target = f * scrollEl.scrollWidth - scrollEl.clientWidth / 2;
      scrollEl.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    }

    thumb.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      thumb.classList.add('is-dragging');
      var startX = e.clientX, startScroll = scrollEl.scrollLeft;
      var perPx = scrollEl.scrollWidth / track.clientWidth;
      function move(ev) { scrollEl.scrollLeft = startScroll + (ev.clientX - startX) * perPx; }
      function up() {
        thumb.classList.remove('is-dragging');
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
        thumb.removeEventListener('pointercancel', up);
      }
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
      thumb.addEventListener('pointercancel', up);
    });
    track.addEventListener('pointerdown', function (e) {
      if (e.target === thumb) return;
      var r = track.getBoundingClientRect();
      scrollToFrac((e.clientX - r.left) / r.width, true);
    });
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.stopPropagation();
      e.preventDefault();
      scrollEl.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * scrollEl.clientWidth * 0.5, behavior: 'smooth' });
    });

    // keep bus labels readable when a segment starts left of the visible area
    var labels = [];
    function pinLabels() {
      var left = scrollEl.scrollLeft + 6;
      labels.forEach(function (l) {
        l.setAttribute('x', Math.max(+l.dataset.x0, left));
      });
    }

    function update() {
      var cx = cursor * pxm;
      var c = document.getElementById('wf-cursor');
      if (c) { c.setAttribute('x1', cx); c.setAttribute('x2', cx); }
      var mk = document.getElementById('wf-marker');
      if (mk) {
        var mx = marker === null ? -10 : marker * pxm;
        mk.setAttribute('x1', mx); mk.setAttribute('x2', mx);
      }
      valEls.forEach(function (el) {
        var v = valueAt(SIGNALS[+el.dataset.i], cursor);
        el.textContent = v;
        el.classList.toggle('is-z', v === 'z' || v === '0' || v.indexOf('0 ') === 0 || v.indexOf('x ') === 0);
      });
      if (tCursor) syncBar();
      readCursor.textContent = fmt(cursor);
      readMarker.textContent = marker === null ? '—' : fmt(marker);
      readDelta.textContent = marker === null ? '—' : fmtDelta(cursor - marker);
    }

    function timeFromEvent(e) {
      var rect = scrollEl.getBoundingClientRect();
      var x = e.clientX - rect.left + scrollEl.scrollLeft;
      return Math.max(0, Math.min(SPAN - 0.01, x / pxm));
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      cursor = timeFromEvent(e);
      update();
    }
    function onClick(e) {
      cursor = timeFromEvent(e);
      marker = Math.floor(cursor) + 0.5;
      update();
    }
    function onDbl() { marker = null; update(); }

    function onKey(e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (document.querySelector('.palette.open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        cursor = Math.floor(cursor) + (e.key === 'ArrowRight' ? 1 : -1) + 0.5;
        cursor = Math.max(0.5, Math.min(SPAN - 0.5, cursor));
        var cx = cursor * pxm;
        if (cx < scrollEl.scrollLeft + 20 || cx > scrollEl.scrollLeft + scrollEl.clientWidth - 20) {
          scrollEl.scrollLeft = cx - scrollEl.clientWidth / 2;
        }
        update();
        e.preventDefault();
      } else if (e.key === 'm') {
        marker = Math.floor(cursor) + 0.5;
        update();
      }
    }

    function zoom(factor) {
      var centerT = (scrollEl.scrollLeft + scrollEl.clientWidth / 2) / pxm;
      pxm = Math.max(scrollEl.clientWidth / SPAN, Math.min(48, pxm * factor));
      render();
      scrollEl.scrollLeft = centerT * pxm - scrollEl.clientWidth / 2;
    }

    root.querySelector('[data-wf="in"]').addEventListener('click', function () { zoom(1.5); });
    root.querySelector('[data-wf="out"]').addEventListener('click', function () { zoom(1 / 1.5); });
    root.querySelector('[data-wf="fit"]').addEventListener('click', function () {
      pxm = scrollEl.clientWidth / SPAN;
      render();
      scrollEl.scrollLeft = 0;
    });

    scrollEl.addEventListener('scroll', function () { pinLabels(); syncBar(); }, { passive: true });
    window.addEventListener('resize', syncBar);
    scrollEl.addEventListener('pointermove', onMove);
    scrollEl.addEventListener('click', onClick);
    scrollEl.addEventListener('dblclick', onDbl);
    document.addEventListener('keydown', onKey);

    render();
    scrollEl.scrollLeft = NOW * pxm - scrollEl.clientWidth * 0.6;
    pinLabels();
    syncBar();

    // a small version of the theme sweep draws the chart in, left to right
    if (window.motion && window.motion.sweepReveal) {
      window.motion.sweepReveal({ el: root, dur: 1100, band: 30, cell: 11 });
    }

    window.__waveformCleanup = function () {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', syncBar);
    };
  }

  window.initWaveform = initWaveform;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaveform);
  } else {
    initWaveform();
  }
})();
