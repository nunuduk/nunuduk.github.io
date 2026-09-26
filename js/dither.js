(function () {
  /*
   * About photo: swaps to its dark-mode picture (data-src-dark) when the theme is dark, and has a
   * hover lens that shows it as a 1-bit Bayer dither in the accent color.
   */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var CELL = 2; // css px per dither dot
  var RADIUS = 52;

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function syncPhotos() {
    document.querySelectorAll('img[data-src-dark]').forEach(function (img) {
      if (!img.dataset.srcLight) img.dataset.srcLight = img.getAttribute('src');
      var want = isDark() ? img.dataset.srcDark : img.dataset.srcLight;
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
  }

  // Fetch and decode the other theme's photo ahead of time, so the first theme switch
  // doesn't have to load it mid-transition.
  function preloadOtherPhotos() {
    document.querySelectorAll('img[data-src-dark]').forEach(function (img) {
      var other = isDark() ? img.dataset.srcLight || img.getAttribute('src') : img.dataset.srcDark;
      if (!other || img.__preloaded === other) return;
      img.__preloaded = other;
      var pre = new Image();
      pre.src = other;
      if (pre.decode) pre.decode().catch(function () {});
    });
  }
  var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 800); };
  if (document.readyState === 'complete') idle(preloadOtherPhotos);
  else window.addEventListener('load', function () { idle(preloadOtherPhotos); });

  new MutationObserver(syncPhotos).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  function initDither() {
    syncPhotos();
    idle(preloadOtherPhotos);
    if (window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.about-photo').forEach(attach);
  }

  function attach(img) {
    if (img.__dither) return;
    img.__dither = true;

    function setup() {
      var w = img.clientWidth, h = img.clientHeight;
      if (!w || !h) return;
      var dpr = window.devicePixelRatio || 1;

      var painted = '';
      var canvas = document.createElement('canvas');
      canvas.className = 'photo-dither';
      var radius = Math.min(RADIUS, w * 0.4);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      img.insertAdjacentElement('afterend', canvas);
      var ctx = canvas.getContext('2d');

      var cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
      var bits = new Uint8Array(cols * rows);

      // sample the photo at dither-cell resolution, replicating object-fit: cover
      function sample() {
        var s = document.createElement('canvas');
        s.width = cols; s.height = rows;
        var sctx = s.getContext('2d');
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var scale = Math.max(cols / iw, rows / ih);
        var dw = iw * scale, dh = ih * scale;
        sctx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
        var data;
        try { data = sctx.getImageData(0, 0, cols, rows).data; } catch (e) { return false; }
        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            var i = (y * cols + x) * 4;
            var lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
            lum = Math.pow(lum, 0.9);
            bits[y * cols + x] = lum < (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 ? 1 : 0;
          }
        }
        painted = '';
        return true;
      }
      if (!sample()) { canvas.remove(); return; }
      img.addEventListener('load', sample); // theme swapped the picture

      var layer = document.createElement('canvas');
      layer.width = canvas.width; layer.height = canvas.height;
      var lctx = layer.getContext('2d');

      function paintLayer() {
        var cs = getComputedStyle(document.documentElement);
        var ink = cs.getPropertyValue('--accent').trim() || '#8f72df';
        var paper = cs.getPropertyValue('--bg').trim() || '#fff';
        if (painted === ink + paper) return;
        painted = ink + paper;
        lctx.fillStyle = paper;
        lctx.fillRect(0, 0, layer.width, layer.height);
        lctx.fillStyle = ink;
        var c = CELL * dpr;
        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            if (bits[y * cols + x]) lctx.fillRect(x * c, y * c, c, c);
          }
        }
      }

      var target = null, pos = null, r = 0, raf = 0;

      function frame() {
        var goal = target ? radius : 0;
        r += (goal - r) * 0.2;
        if (target) pos = pos ? { x: pos.x + (target.x - pos.x) * 0.35, y: pos.y + (target.y - pos.y) * 0.35 } : target;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (pos && r > 0.5) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x * dpr, pos.y * dpr, r * dpr, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(layer, 0, 0);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(pos.x * dpr, pos.y * dpr, r * dpr, 0, Math.PI * 2);
          ctx.lineWidth = dpr;
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
          ctx.stroke();
        }
        if (target || r > 0.5) raf = requestAnimationFrame(frame);
        else raf = 0;
      }

      function kick() { if (!raf) raf = requestAnimationFrame(frame); }

      var wrap = img.parentElement;
      wrap.addEventListener('pointermove', function (e) {
        var rect = img.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) { target = null; kick(); return; }
        paintLayer();
        target = { x: x, y: y };
        kick();
      });
      wrap.addEventListener('pointerleave', function () { target = null; kick(); });
    }

    if (img.complete && img.naturalWidth) setup();
    else img.addEventListener('load', setup, { once: true });
  }

  window.initDither = initDither;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDither);
  } else {
    initDither();
  }
})();
