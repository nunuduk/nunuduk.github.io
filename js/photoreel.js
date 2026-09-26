(function () {
  /*
   * About photo reel: every 10 s the photo changes to the next one, swapped in behind a small crystal
   * line (the theme switch in miniature, motion.sweepReveal): the new photo left of the line, the old one
   * right of it. The first slot is the theme photo (src in light mode, data-reel-dark in dark); the rest
   * come from data-reel. It waits while the pointer is on the photo (the dither lens) or it's off screen.
   */
  var EVERY = 10000;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      if (busy || document.hidden || !onScreen || wrap.matches(':hover')) { schedule(1500); return; }
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

        var sweep = window.motion && window.motion.sweepReveal;
        var run = sweep ? sweep({
          el: wrap, dur: 1100, band: 28, cell: 10, curtain: false, keep: true,
          onMove: function (sx, lean) {
            over.style.clipPath = 'polygon(0 0, ' + (sx + lean) + 'px 0, ' + sx + 'px 100%, 0 100%)';
          }
        }) : Promise.resolve();

        return run.then(function () {
          img.setAttribute('src', src);
          i = k;
          // drop the overlay once the photo underneath has the new picture
          var done = function () { requestAnimationFrame(function () { over.remove(); }); };
          if (img.complete) done(); else img.addEventListener('load', done, { once: true });
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
