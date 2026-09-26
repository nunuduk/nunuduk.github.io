(function () {
  /*
   * Gallery viewer. Every gallery card opens here: the piece sits in the middle of the screen, everything
   * else is dimmed, and the ambiance strokes from the 100% card radiate from the frame's edges (holo.js
   * with a rectangle mask, drawn hollow so only the light around it shows).
   * Video cards also preview on hover: the first 3 seconds, looping, muted.
   */
  var PREVIEW = 3; // seconds of video shown on hover
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover)').matches;

  var box, glowCanvas, stage, frame, caption, closeBtn, bar;
  var amb = null, rect = null, content = null, lastFocus = null, aspect = 1;

  function build() {
    box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.hidden = true;
    box.innerHTML =
      '<canvas class="lb-glow" aria-hidden="true"></canvas>' +
      '<figure class="lb-stage"><div class="lb-frame"></div>' +
      // the video's own controls, in the style of the 100% card's scrubber
      '<div class="lb-bar" hidden>' +
      // each button holds both of its labels in one grid cell (one hidden), so it's always as wide as the longer
      '<button type="button" class="lb-play is-on" aria-label="Pause"><span class="lb-lbl"><span class="lb-on">pause</span><span class="lb-off">play</span></span></button>' +
      '<input type="range" class="lb-scrub" id="lb-scrub" min="0" max="1" step="0.01" value="0" aria-label="Video position in seconds">' +
      '<span class="lb-time">0:00 / 0:00</span>' +
      '<button type="button" class="lb-sound is-on" aria-pressed="true"><span class="lb-lbl"><span class="lb-on">sound on</span><span class="lb-off">sound off</span></span></button>' +
      '</div>' +
      '<figcaption class="lb-caption"></figcaption></figure>' +
      '<button type="button" class="lb-close" aria-label="Close">close ×</button>';
    document.body.appendChild(box);
    glowCanvas = box.querySelector('.lb-glow');
    stage = box.querySelector('.lb-stage');
    frame = box.querySelector('.lb-frame');
    caption = box.querySelector('.lb-caption');
    closeBtn = box.querySelector('.lb-close');
    bar = box.querySelector('.lb-bar');
    wireBar();

    closeBtn.addEventListener('click', close);
    // a click anywhere but the piece and its controls closes
    box.addEventListener('click', function (e) { if (!frame.contains(e.target) && !bar.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') {
        // keep focus inside the dialog, cycling through its controls
        var f = [].filter.call(box.querySelectorAll('button, input'), function (el) { return !el.closest('[hidden]'); });
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      } else if (e.key === ' ' && isVideo() && !/^(BUTTON|INPUT)$/.test(e.target.tagName)) {
        e.preventDefault();
        togglePlay();
      }
    });
    var rt;
    window.addEventListener('resize', function () {
      if (box.hidden) return;
      clearTimeout(rt);
      rt = setTimeout(function () { layout(); if (amb) amb.resize(); }, 120);
    });
  }

  function isVideo() { return content && content.tagName === 'VIDEO'; }

  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }

  function togglePlay() {
    if (!isVideo()) return;
    if (content.paused) content.play().catch(function () {}); else content.pause();
  }

  // play / pause, scrub, time, sound: the bar reads everything from the video, so it can't drift
  function wireBar() {
    var play = bar.querySelector('.lb-play'), scrub = bar.querySelector('.lb-scrub');
    var time = bar.querySelector('.lb-time'), sound = bar.querySelector('.lb-sound');
    var scrubbing = false, raf = 0;
    play.addEventListener('click', togglePlay);
    sound.addEventListener('click', function () { if (isVideo()) { content.muted = !content.muted; sync(); } });
    scrub.addEventListener('input', function () {
      if (!isVideo()) return;
      scrubbing = true;
      content.currentTime = parseFloat(scrub.value);
      sync();
    });
    scrub.addEventListener('change', function () { scrubbing = false; });
    function sync() {
      if (!isVideo()) return;
      var d = content.duration || 0;
      scrub.max = d || 1;
      if (!scrubbing) scrub.value = content.currentTime;
      scrub.style.setProperty('--p', d ? (content.currentTime / d) * 100 + '%' : '0%');
      time.textContent = fmt(content.currentTime) + ' / ' + fmt(d);
      var on = !content.paused;
      play.setAttribute('aria-label', on ? 'Pause' : 'Play');
      play.classList.toggle('is-on', on);
      sound.setAttribute('aria-pressed', content.muted ? 'false' : 'true');
      sound.classList.toggle('is-on', !content.muted);
    }
    function tick() { sync(); raf = isVideo() && !box.hidden ? requestAnimationFrame(tick) : 0; }
    bar.__start = function (v) {
      ['play', 'pause', 'loadedmetadata', 'volumechange', 'seeked'].forEach(function (ev) { v.addEventListener(ev, sync); });
      v.addEventListener('click', togglePlay); // clicking the picture plays / pauses
      sync();
      if (!raf) raf = requestAnimationFrame(tick);
    };
  }

  // the biggest frame of this aspect that fits, leaving room for the light and the caption
  function layout() {
    var maxW = Math.min(window.innerWidth - 48, 1100);
    var maxH = window.innerHeight * 0.74;
    var w = maxW, h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    frame.style.width = Math.round(w) + 'px';
    frame.style.height = Math.round(h) + 'px';
    // the controls can run wider than a narrow (portrait) picture, never wider than the screen
    bar.style.width = Math.round(Math.min(Math.max(w, 460), window.innerWidth - 32)) + 'px';
    var r = frame.getBoundingClientRect();
    rect = { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function startGlow() {
    if (reduce || !window.createHolo) return;
    if (!amb) {
      amb = window.createHolo(glowCanvas, {
        mask: function (ctx, w, h, dpr) {
          if (!rect) return;
          ctx.fillStyle = '#fff';
          ctx.fillRect(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
        },
        glow: 0.7, hollow: true, shard: 12, rise: 14, maxDpr: 1.5, timeOffset: 3
      });
      if (!amb) return;
    } else {
      amb.resize(); // repaint the mask for this frame
    }
    amb.start();
  }

  function open(item) {
    if (!box) build();
    lastFocus = document.activeElement;
    var video = item.querySelector('video');
    var img = item.querySelector('img');
    var holo = item.querySelector('canvas[data-holo]');
    var cap = item.querySelector('.gallery-caption');
    caption.textContent = cap ? cap.textContent : '';
    box.setAttribute('aria-label', caption.textContent || 'Gallery piece');
    frame.className = 'lb-frame';

    if (video) {
      aspect = (video.videoWidth / video.videoHeight) || 9 / 16;
      content = document.createElement('video');
      content.src = video.currentSrc || video.getAttribute('src');
      content.poster = video.getAttribute('poster') || '';
      content.controls = false; // the bar below takes over
      content.playsInline = true;
      content.setAttribute('playsinline', '');
      content.loop = true;
    } else if (holo) {
      aspect = 16 / 9;
      frame.classList.add('holo-frame');
      content = document.createElement('canvas');
      ['holo', 'holoMask', 'holoGlow', 'holoFill', 'holoLoop', 'holoSupersample', 'holoInteractive'].forEach(function (k) {
        if (k in holo.dataset) content.dataset[k] = holo.dataset[k];
      });
      content.setAttribute('aria-label', holo.getAttribute('aria-label') || '');
    } else if (img) {
      aspect = (img.naturalWidth / img.naturalHeight) || 5 / 7;
      content = document.createElement('img');
      content.src = img.currentSrc || img.src;
      content.alt = img.alt;
    } else {
      return;
    }
    content.className = 'lb-media';
    frame.appendChild(content);
    bar.hidden = !video;
    if (video) bar.__start(content);

    box.hidden = false;
    document.documentElement.classList.add('lb-open');
    layout();
    requestAnimationFrame(function () { box.classList.add('is-in'); });
    closeBtn.focus();

    if (holo && window.initHolo) window.initHolo();
    if (video) {
      // opened by a click, so sound is allowed; if the browser still refuses, play muted
      content.play().catch(function () { content.muted = true; content.play().catch(function () {}); });
    }
    startGlow();
  }

  function close() {
    if (!box || box.hidden) return;
    box.classList.remove('is-in');
    if (amb) amb.stop();
    if (content) {
      if (content.tagName === 'VIDEO') { content.pause(); content.removeAttribute('src'); content.load(); }
      if (content.__holoApi && content.__holoApi.dispose) content.__holoApi.dispose();
      content.remove();
      content = null;
    }
    box.hidden = true;
    document.documentElement.classList.remove('lb-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // hover preview: the first few seconds, looping while the pointer is on the card
  function wirePreview(item, video) {
    if (!canHover || reduce) return;
    var timer = 0;
    item.addEventListener('pointerenter', function () {
      video.currentTime = 0;
      video.play().catch(function () {});
      clearInterval(timer);
      timer = setInterval(function () { if (video.currentTime >= PREVIEW) video.currentTime = 0; }, 100);
    });
    item.addEventListener('pointerleave', function () {
      clearInterval(timer);
      video.pause();
      video.currentTime = 0;
    });
  }

  function initGallery() {
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      if (item.__lb) return;
      item.__lb = true;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      var cap = item.querySelector('.gallery-caption');
      item.setAttribute('aria-label', 'Open ' + (cap ? cap.textContent : 'piece'));
      item.addEventListener('click', function (e) {
        if (e.target.closest('.holo-controls')) return; // the 100% card's scrubber stays usable
        open(item);
      });
      item.addEventListener('keydown', function (e) {
        if (e.target !== item) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); }
      });
      var v = item.querySelector('video');
      if (v) wirePreview(item, v);
    });
  }

  window.initGallery = initGallery;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGallery);
  } else {
    initGallery();
  }
})();
