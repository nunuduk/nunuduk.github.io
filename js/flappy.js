(function () {
  var W = 400;
  var H = 600;

  function initFlappy() {
    var root = document.querySelector('.flappy-page');
    if (!root) return;

    if (typeof window.__flappyCleanup === 'function') {
      window.__flappyCleanup();
      window.__flappyCleanup = null;
    }

    var canvas = root.querySelector('#flappy-canvas');
    var scoreEl = root.querySelector('#flappy-score');
    var hintEl = root.querySelector('#flappy-hint');
    if (!canvas || !scoreEl || !hintEl) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var gravity = 0.42;
    var flapVel = -8.2;
    var pipeW = 56;
    var pipeSpeed = 3.2;
    var gapH = 150;
    var pipeSpacing = 228;
    var birdX = 88;
    var birdW = 36;
    var birdH = 28;

    var state = {
      birdY: H * 0.45,
      birdVy: 0,
      pipes: [],
      frame: 0,
      score: 0,
      playing: false,
      gameOver: false,
      raf: null
    };

    function resetGame() {
      state.birdY = H * 0.45;
      state.birdVy = 0;
      state.pipes = [];
      state.frame = 0;
      state.score = 0;
      state.playing = false;
      state.gameOver = false;
      scoreEl.textContent = '0';
      hintEl.textContent = 'click, space, or tap to flap';
      spawnInitialPipes();
    }

    function spawnPipePair() {
      var minTop = 72;
      var maxTop = H - gapH - minTop;
      var topH = minTop + Math.random() * (maxTop - minTop);
      state.pipes.push({
        id: state.frame + Math.random(),
        x: W + pipeW,
        topH: topH,
        scored: false
      });
    }

    function spawnInitialPipes() {
      state.pipes = [];
      for (var i = 0; i < 3; i++) {
        var minTop = 72;
        var maxTop = H - gapH - minTop;
        var topH = minTop + Math.random() * (maxTop - minTop);
        state.pipes.push({
          id: 'p' + i + '-' + Date.now(),
          x: W + 60 + i * pipeSpacing,
          topH: topH,
          scored: false
        });
      }
    }

    function maybeSpawnPipe() {
      if (state.pipes.length === 0) {
        spawnPipePair();
        return;
      }
      var right = state.pipes[state.pipes.length - 1];
      if (right.x < W - pipeSpacing) {
        spawnPipePair();
      }
    }

    function flap() {
      if (state.gameOver) {
        resetGame();
        state.playing = true;
        state.birdVy = flapVel;
        return;
      }
      if (!state.playing) {
        state.playing = true;
      }
      state.birdVy = flapVel;
    }

    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function tick() {
      state.frame++;

      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c45c26';
      var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f4f0e8';
      var border = getComputedStyle(document.documentElement).getPropertyValue('--border-mid').trim() || '#ccc';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (state.playing && !state.gameOver) {
        state.birdVy += gravity;
        state.birdY += state.birdVy;

        maybeSpawnPipe();

        for (var i = state.pipes.length - 1; i >= 0; i--) {
          var p = state.pipes[i];
          p.x -= pipeSpeed;

          ctx.fillStyle = accent;
          ctx.strokeStyle = border;
          ctx.lineWidth = 2;
          ctx.fillRect(p.x, 0, pipeW, p.topH);
          ctx.strokeRect(p.x, 0, pipeW, p.topH);
          ctx.fillRect(p.x, p.topH + gapH, pipeW, H - (p.topH + gapH));
          ctx.strokeRect(p.x, p.topH + gapH, pipeW, H - (p.topH + gapH));

          if (!p.scored && p.x + pipeW < birdX) {
            p.scored = true;
            state.score++;
            scoreEl.textContent = String(state.score);
          }

          if (p.x + pipeW < -20) {
            state.pipes.splice(i, 1);
          }
        }

        var by = state.birdY;
        var bx = birdX;

        if (by < 0 || by + birdH > H) {
          state.gameOver = true;
          state.playing = false;
          hintEl.textContent = 'game over — click to restart';
        }

        for (var j = 0; j < state.pipes.length; j++) {
          var pipe = state.pipes[j];
          if (
            rectsOverlap(bx, by, birdW, birdH, pipe.x, 0, pipeW, pipe.topH) ||
            rectsOverlap(bx, by, birdW, birdH, pipe.x, pipe.topH + gapH, pipeW, H - pipe.topH - gapH)
          ) {
            state.gameOver = true;
            state.playing = false;
            hintEl.textContent = 'game over — click to restart';
            break;
          }
        }
      } else {
        for (var k = 0; k < state.pipes.length; k++) {
          var q = state.pipes[k];
          ctx.fillStyle = accent;
          ctx.strokeStyle = border;
          ctx.lineWidth = 2;
          ctx.fillRect(q.x, 0, pipeW, q.topH);
          ctx.strokeRect(q.x, 0, pipeW, q.topH);
          ctx.fillRect(q.x, q.topH + gapH, pipeW, H - (q.topH + gapH));
          ctx.strokeRect(q.x, q.topH + gapH, pipeW, H - (q.topH + gapH));
        }
      }

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(birdX + birdW / 2, state.birdY + birdH / 2, birdW / 2, birdH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();

      state.raf = requestAnimationFrame(tick);
    }

    function onKeyDown(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        flap();
      }
    }

    function onPointerDown(e) {
      e.preventDefault();
      flap();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    resetGame();
    state.raf = requestAnimationFrame(tick);

    window.__flappyCleanup = function () {
      if (state.raf) cancelAnimationFrame(state.raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  window.initFlappy = initFlappy;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlappy);
  } else {
    initFlappy();
  }
})();
