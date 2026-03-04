(function () {
  var STORAGE_START = 'particle-start-time';
  var STORAGE_SHAPES = 'particle-shapes';
  var STORAGE_COUNT = 'particle-count';
  var STORAGE_ENABLED = 'particles-enabled';
  var STORAGE_WORDS = 'particle-words-enabled';
  var NUM_PARTICLES = 20;
  var COUNT_MIN = 14;
  var COUNT_MAX = 20;
  var DURATION_MIN = 55;
  var DURATION_MAX = 145;
  var MIN_WIDTH = 44;
  var MIN_HEIGHT = 26;
  var WORD_LIST = ['idea', 'sketch', 'form', 'flow', 'make', 'draw', 'type', 'color', 'space', 'line', 'imagine', 'create', 'design', 'think', 'edit', 'refine', 'draft', 'develop', 'define', 'discover', 'ideate', 'prototype', 'implement', 'test'];
  var rainbowStarted = false;
  var HUE_STOPS = [0, 24, 48, 72, 120, 155, 190, 215, 245, 275, 305, 330];
  var shapesCache = null;
  var wordsEnabled = getWordsEnabled();

  function randomIn(min, max) {
    return min + Math.random() * (max - min);
  }

  function shuffleArray(arr) {
    var i = arr.length;
    while (i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function uniqueDurations(n) {
    var pool = [];
    for (var d = DURATION_MIN; d <= DURATION_MAX; d++) pool.push(d);
    return shuffleArray(pool).slice(0, n);
  }

  function getParticlesEnabled() {
    var v = localStorage.getItem(STORAGE_ENABLED);
    if (v === '0') return false;
    if (v === '1') return true;
    return true;
  }

  function setParticlesEnabled(on) {
    localStorage.setItem(STORAGE_ENABLED, on ? '1' : '0');
  }

  function getWordsEnabled() {
    var v = localStorage.getItem(STORAGE_WORDS);
    if (v === '1') return true;
    if (v === '0') return false;
    return false; // default: no text
  }

  function setWordsEnabled(on) {
    localStorage.setItem(STORAGE_WORDS, on ? '1' : '0');
  }

  function generateParticles() {
    var durations = uniqueDurations(NUM_PARTICLES);
    var words = shuffleArray(WORD_LIST.slice(0));
    var shapes = [];
    for (var i = 0; i < NUM_PARTICLES; i++) {
      var w = Math.round(randomIn(MIN_WIDTH, 72));
      var h = Math.round(randomIn(MIN_HEIGHT, 56));
      var baseHue = HUE_STOPS[Math.floor(Math.random() * HUE_STOPS.length)];
      var hue = (baseHue + Math.round(randomIn(-10, 10)) + 360) % 360;
      shapes.push({
        w: w,
        h: h,
        top: randomIn(-2, 96),
        hue: hue,
        alpha: Math.round(randomIn(3, 12)) / 100,
        duration: durations[i],
        phaseOffset: Math.round(randomIn(0, 90)),
        fontSize: Math.round(randomIn(42, 58)) / 100,
        word: words[i] || WORD_LIST[i % WORD_LIST.length]
      });
    }
    return shapes;
  }

  function getOrCreateShapes() {
    try {
      var raw = localStorage.getItem(STORAGE_SHAPES);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === NUM_PARTICLES) {
          var used = {};
          parsed.forEach(function (p) {
            if (p.duration != null) used[p.duration] = true;
          });
          var pool = [];
          for (var d = DURATION_MIN; d <= DURATION_MAX; d++) {
            if (!used[d]) pool.push(d);
          }
          shuffleArray(pool);
          var wordPool = WORD_LIST.slice(0);
          var usedWords = {};
          parsed.forEach(function (p) {
            if (p.word) usedWords[p.word] = true;
          });
          wordPool = wordPool.filter(function (w) { return !usedWords[w]; });
          shuffleArray(wordPool);
          var needsSave = false;
          parsed.forEach(function (p) {
            if (p.duration == null && pool.length) {
              p.duration = pool.pop();
              needsSave = true;
            }
            if (p.w < MIN_WIDTH) { p.w = MIN_WIDTH; needsSave = true; }
            if (p.h < MIN_HEIGHT) { p.h = MIN_HEIGHT; needsSave = true; }
            if (p.hue == null) {
              var b = HUE_STOPS[Math.floor(Math.random() * HUE_STOPS.length)];
              p.hue = (b + Math.round(randomIn(-10, 10)) + 360) % 360;
              needsSave = true;
            }
            if (p.alpha == null) {
              p.alpha = Math.round(randomIn(3, 12)) / 100;
              needsSave = true;
            }
            if (p.phaseOffset == null) {
              p.phaseOffset = Math.round(randomIn(0, 90));
              needsSave = true;
            }
            if (p.fontSize == null) {
              p.fontSize = Math.round(randomIn(42, 58)) / 100;
              needsSave = true;
            }
            if (!p.word && wordPool.length) {
              p.word = wordPool.pop();
              needsSave = true;
            } else if (!p.word) {
              p.word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
              needsSave = true;
            }
          });
          if (needsSave) localStorage.setItem(STORAGE_SHAPES, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (e) {}
    var shapes = generateParticles();
    localStorage.setItem(STORAGE_SHAPES, JSON.stringify(shapes));
    return shapes;
  }

  function getParticleCount() {
    var v = localStorage.getItem(STORAGE_COUNT);
    if (v != null) {
      var n = parseInt(v, 10);
      if (n >= COUNT_MIN && n <= COUNT_MAX) return n;
    }
    var n = Math.floor(randomIn(COUNT_MIN, COUNT_MAX + 1));
    localStorage.setItem(STORAGE_COUNT, String(n));
    return n;
  }

  function applyShapes() {
    var deco = document.querySelector('.floating-deco');
    if (!deco) return getOrCreateShapes();
    var shapes = getOrCreateShapes();
    var spans = deco.querySelectorAll('span');
    shapes.forEach(function (p, i) {
      var span = spans[i];
      if (!span) return;
      var hue = p.hue != null ? p.hue : 270;
      var alpha = p.alpha != null ? p.alpha : 0.55;
      var fill = 'hsla(' + hue + ', 80%, 82%, ' + alpha + ')';
      span.style.width = p.w + 'px';
      span.style.height = p.h + 'px';
      span.style.top = p.top + '%';
      span.style.animationDuration = p.duration + 's';
      span.style.fontSize = (p.fontSize != null ? p.fontSize : 0.5) + 'rem';
      span.textContent = wordsEnabled ? (p.word || '') : '';
      span.style.backgroundColor = fill;
    });
    shapesCache = shapes;
    return shapes;
  }

  function getStartTime() {
    var v = localStorage.getItem(STORAGE_START);
    if (v != null) return parseFloat(v);
    var t = Date.now();
    localStorage.setItem(STORAGE_START, String(t));
    return t;
  }

  function applyCount(n) {
    n = Math.max(0, Math.min(NUM_PARTICLES, n));
    var deco = document.querySelector('.floating-deco');
    if (!deco) return;
    var spans = deco.querySelectorAll('span');
    spans.forEach(function (span, i) {
      span.style.display = i < n ? '' : 'none';
    });
  }

  function syncAnimationPhase(shapes) {
    var deco = document.querySelector('.floating-deco');
    if (!deco || !shapes) return;
    var startTime = getStartTime();
    var elapsedSec = (Date.now() - startTime) / 1000;
    var spans = deco.querySelectorAll('span');
    shapes.forEach(function (p, i) {
      var span = spans[i];
      if (!span) return;
      var duration = p.duration;
      var offset = p.phaseOffset != null ? p.phaseOffset : 0;
      var phase = (elapsedSec + offset) % duration;
      span.style.animationDelay = -phase + 's';
    });
  }

  function startRainbowTicker() {
    if (rainbowStarted) return;
    var deco = document.querySelector('.floating-deco');
    if (!deco) return;
    rainbowStarted = true;

    function scheduleNext() {
      var wait = randomIn(25000, 60000);
      setTimeout(function () {
        var decoEl = document.querySelector('.floating-deco');
        if (!decoEl) return;
        var all = decoEl.querySelectorAll('span');
        var visibles = [];
        all.forEach(function (span) {
          if (span.style.display !== 'none') visibles.push(span);
        });
        if (!visibles.length) {
          scheduleNext();
          return;
        }
        var target = visibles[Math.floor(Math.random() * visibles.length)];
        target.classList.add('particle-rainbow');
        var life = randomIn(6000, 12000);
        setTimeout(function () {
          target.classList.remove('particle-rainbow');
          scheduleNext();
        }, life);
      }, wait);
    }

    scheduleNext();
  }

  function init() {
    var deco = document.querySelector('.floating-deco');
    var toggle = document.querySelector('[data-particles-toggle]');
    if (!deco && !toggle) return;

    var enabled = getParticlesEnabled();

    if (deco) {
      deco.style.display = enabled ? '' : 'none';
    }

    if (toggle) {
      toggle.textContent = enabled ? 'particles on' : 'particles off';
      toggle.title = 'click: particles on/off · alt-click: labels on/off';
      toggle.addEventListener('click', function (e) {
        // Alt-click toggles label text without touching visibility
        if (e.altKey) {
          wordsEnabled = !wordsEnabled;
          setWordsEnabled(wordsEnabled);
          if (deco) {
            var spans = deco.querySelectorAll('span');
            var shapes = shapesCache || getOrCreateShapes();
            spans.forEach(function (span, i) {
              var p = shapes[i];
              if (!p || !span) return;
              span.textContent = wordsEnabled ? (p.word || '') : '';
            });
          }
          return;
        }

        enabled = !enabled;
        setParticlesEnabled(enabled);
        if (deco) {
          deco.style.display = enabled ? '' : 'none';
        }
        toggle.textContent = enabled ? 'particles on' : 'particles off';
        if (enabled && deco) {
          var shapesNow = applyShapes();
          var countNow = getParticleCount();
          applyCount(countNow);
          syncAnimationPhase(shapesNow);
          startRainbowTicker();
        }
      });
    }

    if (!enabled || !deco) return;

    var shapes = applyShapes();
    var count = getParticleCount();
    applyCount(count);
    syncAnimationPhase(shapes);
    startRainbowTicker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
