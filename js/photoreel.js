(function () {
  /*
   * About photo reel: every 10 s the photo changes to the next one, swapped in behind a small crystal
   * line (the theme switch in miniature, motion.sweepReveal): the new photo left of the line, the old one
   * right of it. The first slot is the theme photo (src in light mode, data-reel-dark in dark); the rest
   * come from data-reel. It waits while the pointer is on the photo (the dither lens) or it's off screen.
   */
  var EVERY = 10000;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // only a real pointer pauses it: on a phone a tap leaves :hover stuck on, which would stop the reel
  var canHover = window.matchMedia('(hover: hover)').matches;

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // fetch and decode a picture, so swapping it in doesn't flash
  function preload(src) {
    return new Promise(function (res) {
      var p = new Image();
      p.onload = p.onerror = function () { res(p); };
      p.src = src;
    }).then(function (p) {
      return p.decode ? p.decode().catch(function () {}) : null;
    });
  }

  function initPhotoReel() {
    var img = document.querySelector('.about-photo[data-reel]');
    if (!img || img.__reel || reduce) return;
    img.__reel = true;
    var wrap = img.parentElement;
    var light = img.getAttribute('src'), dark = img.dataset.reelDark || light;
    var list = img.dataset.reel.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var i = 0, busy = false, onScreen = true, timer = 0;

    function srcAt(k) { return k === 0 ? (isDark() ? dark : light) : list[k - 1]; }
    if (img.getAttribute('src') !== srcAt(0)) img.setAttribute('src', srcAt(0));

    // on the theme photo, follow the theme switch like before
    new MutationObserver(function () {
      if (i === 0 && !busy && img.getAttribute('src') !== srcAt(0)) img.setAttribute('src', srcAt(0));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; }).observe(wrap);
    }

    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    }

    function next() {
      if (!img.isConnected) return; // the page was swapped out (spa.js); a fresh init takes over
      if (busy || document.hidden || !onScreen || (canHover && wrap.matches(':hover'))) { schedule(1500); return; }
      busy = true;
      var k = (i + 1) % (list.length + 1), src = srcAt(k);
      preload(src).then(function () {
        var over = document.createElement('img');
        over.className = 'about-photo about-photo-next';
        over.alt = '';
        over.setAttribute('aria-hidden', 'true');
        over.src = src;
        over.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)';
        wrap.appendChild(over);

        if (window.sfx) window.sfx.photoTick(); // a quick, muffled sparkle of the theme switch's glass
        var sweep = window.motion && window.motion.sweepReveal;
        var run = sweep ? sweep({
          el: wrap, dur: 1100, band: 28, cell: 10, curtain: false, keep: true,
          onMove: function (sx, lean) {
            // the edge trails a little inside the crystal band, so it stays covered even if the band's
            // canvas shows a frame late (Safari)
            var x = sx - 10;
            over.style.clipPath = 'polygon(0 0, ' + (x + lean) + 'px 0, ' + x + 'px 100%, 0 100%)';
          }
        }) : Promise.resolve();

        return run.then(function () {
          over.style.clipPath = 'none'; // fully the new photo, whatever the last frame of the sweep was
          img.setAttribute('src', src);
          i = k;
          // drop the overlay only once the photo underneath has decoded the new picture, a frame later,
          // so it can't flash the old one (Safari reports complete before it has repainted)
          var decoded = img.decode ? img.decode().catch(function () {}) : new Promise(function (res) {
            if (img.complete) res(); else img.addEventListener('load', res, { once: true });
          });
          return decoded.then(function () {
            requestAnimationFrame(function () { requestAnimationFrame(function () { over.remove(); }); });
          });
        });
      }).then(function () {
        busy = false;
        schedule(EVERY);
        var after = srcAt((i + 1) % (list.length + 1));
        if (after) preload(after); // get the next one ready while this one shows
      });
    }

    preload(srcAt(1));
    schedule(EVERY);
  }

  window.initPhotoReel = initPhotoReel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhotoReel);
  } else {
    initPhotoReel();
  }
})();
