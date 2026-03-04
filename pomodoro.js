(function () {
  function initPomodoro() {
    var root = document.querySelector('.pomodoro-page');
    if (!root) return;

    // Clean up any previous timer instance
    if (typeof window.__pomodoroCleanup === 'function') {
      window.__pomodoroCleanup();
      window.__pomodoroCleanup = null;
    }

    var WORK_MIN = 25;
    var BREAK_MIN = 5;
    var state = { mode: 'work', remaining: WORK_MIN * 60, running: false, interval: null };

    var timeEl = root.querySelector('#pomodoro-time');
    var phaseEl = root.querySelector('#pomodoro-phase');
    var startBtn = root.querySelector('#pomodoro-start');

    if (!timeEl || !phaseEl || !startBtn) return;

    function format(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function updatePresetActive() {
      root.querySelectorAll('.pomodoro-preset[data-min]').forEach(function (btn) {
        var min = parseInt(btn.getAttribute('data-min'), 10);
        btn.classList.toggle('is-active', !isNaN(min) && min === WORK_MIN);
      });
      root.querySelectorAll('.pomodoro-preset-break').forEach(function (btn) {
        var min = parseInt(btn.getAttribute('data-break'), 10);
        btn.classList.toggle('is-active', !isNaN(min) && min === BREAK_MIN);
      });
    }

    function render() {
      timeEl.textContent = format(state.remaining);
      phaseEl.textContent = state.mode === 'work' ? 'work' : 'break';
      startBtn.textContent = state.running ? 'pause' : 'start';
      updatePresetActive();
    }

    function playChime() {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        o.start();
        o.stop(ctx.currentTime + 0.7);
      } catch (e) {}
    }

    function advancePhase() {
      playChime();
      if (state.mode === 'work') {
        state.mode = 'break';
        state.remaining = BREAK_MIN * 60;
      } else if (state.mode === 'break') {
        state.mode = 'work';
        state.remaining = WORK_MIN * 60;
      }
    }

    function clearTimer() {
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
      }
      state.running = false;
    }

    function tick() {
      if (state.remaining <= 0) {
        clearTimer();
        advancePhase();
        render();
        return;
      }
      state.remaining--;
      render();
    }

    window.pomodoroStartPause = function () {
      if (state.running) {
        clearTimer();
      } else {
        state.running = true;
        state.interval = setInterval(tick, 1000);
      }
      render();
    };

    window.pomodoroReset = function () {
      clearTimer();
      state.mode = 'work';
      state.remaining = WORK_MIN * 60;
      render();
    };

    window.pomodoroSkip = function () {
      clearTimer();
      advancePhase();
      render();
    };

    root.querySelectorAll('.pomodoro-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var min = parseInt(btn.getAttribute('data-min'), 10);
        if (isNaN(min)) return;
        WORK_MIN = min;
        if (state.mode === 'work') {
          state.remaining = WORK_MIN * 60;
        }
        render();
      });
    });

    root.querySelectorAll('.pomodoro-preset-break').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var min = parseInt(btn.getAttribute('data-break'), 10);
        if (isNaN(min)) return;
        BREAK_MIN = min;
        if (state.mode === 'break') {
          state.remaining = BREAK_MIN * 60;
        }
        render();
      });
    });

    window.__pomodoroCleanup = function () {
      clearTimer();
    };

    render();
  }

  window.initPomodoro = initPomodoro;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPomodoro);
  } else {
    initPomodoro();
  }
})();

