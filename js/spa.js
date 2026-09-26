(function () {
  if (!window.history || !window.fetch || !window.DOMParser) return;

  var main = document.querySelector('main');
  if (!main) return;

  /* pages that were folded into sections of the landing page */
  var MERGED = {
    'about.html': 'index.html',
    'projects.html': 'index.html#projects',
    'gallery.html': 'index.html#gallery',
    'publications.html': 'index.html#publications'
  };

  function pageOf(href) {
    var last = (href || '').split('#')[0].split('/').pop();
    return last && last.length ? last : 'index.html';
  }

  function hashOf(href) {
    var i = (href || '').indexOf('#');
    return i < 0 ? '' : href.slice(i + 1);
  }

  function currentPageFromLocation() {
    return pageOf(window.location.pathname);
  }

  function isInternalHtmlLink(a) {
    if (!a || !a.getAttribute) return false;
    var href = a.getAttribute('href');
    if (!href) return false;
    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) return false;
    if (href.indexOf('mailto:') === 0 || href.indexOf('#') === 0) return false;
    if (!href.split('#')[0].endsWith('.html')) return false;
    return true;
  }

  function setActiveNav(href) {
    if (typeof window.setActiveNav === 'function') {
      window.setActiveNav(href);
      return;
    }
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a');
    links.forEach(function (link) {
      var linkHref = link.getAttribute('href');
      link.classList.toggle('active', linkHref === href);
    });
  }

  function scrollToHash(hash, smooth) {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    var el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function teardownPage() {
    if (typeof window.__flappyCleanup === 'function') {
      window.__flappyCleanup();
      window.__flappyCleanup = null;
    }
    if (typeof window.__waveformCleanup === 'function') {
      window.__waveformCleanup();
      window.__waveformCleanup = null;
    }
    if (typeof window.__pomodoroCleanup === 'function') {
      window.__pomodoroCleanup();
      window.__pomodoroCleanup = null;
    }
  }

  function runPageInits(href) {
    var last = pageOf(href || currentPageFromLocation());

    if (last === 'pomodoro.html' && typeof window.initPomodoro === 'function') {
      window.initPomodoro();
    } else if (last === 'flappy.html' && typeof window.initFlappy === 'function') {
      window.initFlappy();
    } else if (last === 'surprise.html' && typeof window.initSurprise === 'function') {
      window.initSurprise();
    } else if (last === 'waveform.html' && typeof window.initWaveform === 'function') {
      window.initWaveform();
    }
    if (last === 'index.html') {
      if (typeof window.initDither === 'function') window.initDither();
      if (typeof window.initHolo === 'function') window.initHolo();
    }
  }

  function navigate(href, opts) {
    opts = opts || {};
    href = MERGED[pageOf(href)] && !hashOf(href) ? MERGED[pageOf(href)] : href;

    // same page: just scroll
    if (pageOf(href) === main.dataset.page) {
      var hash = hashOf(href);
      window.history.pushState({ href: href }, '', href);
      if (window.lockScrollSpy) window.lockScrollSpy();
      setActiveNav(href);
      scrollToHash(hash, true);
      return;
    }
    loadPage(href, opts);
  }

  function enhanceLinks() {
    var links = document.querySelectorAll('a[href]:not([data-no-spa])');
    links.forEach(function (a) {
      if (a.__spaBound) return;
      if (!isInternalHtmlLink(a)) return;
      a.__spaBound = true;
      a.addEventListener('click', function (e) {
        // allow modifier keys / middle click to behave normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        if (!href) return;
        navigate(href);
      });
    });
  }

  async function loadPage(href, opts) {
    opts = opts || {};
    try {
      var res = await fetch(href.split('#')[0], { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var text = await res.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(text, 'text/html');
      var newMain = doc.querySelector('main');
      var newTitle = doc.querySelector('title');
      if (!newMain) throw new Error('no <main> in ' + href);

      var swap = function () {
        teardownPage();
        main.replaceWith(newMain);
        main = newMain;
        main.dataset.page = pageOf(href);
        if (newTitle && newTitle.textContent) {
          document.title = newTitle.textContent;
        }
        if (!opts.fromPopstate) {
          window.history.pushState({ href: href }, '', href);
        }
        scrollToHash(hashOf(href), false);
        // prepare the entrance inside the swap so the new page never flashes in unstyled
        if (window.motion) window.motion.enter(main, 140);
      };

      if (window.motion) await window.motion.transition(swap);
      else swap();

      setActiveNav(href);
      enhanceLinks();
      runPageInits(href);
    } catch (e) {
      console.error('SPA navigation failed, falling back to full load', e);
      window.location.href = href;
    }
  }

  window.addEventListener('popstate', function (event) {
    var href = (event.state && event.state.href) || (currentPageFromLocation() + window.location.hash);
    if (pageOf(href) === main.dataset.page) {
      if (window.lockScrollSpy) window.lockScrollSpy();
      setActiveNav(href);
      scrollToHash(hashOf(href), true);
      return;
    }
    loadPage(href, { fromPopstate: true });
  });

  main.dataset.page = currentPageFromLocation();

  window.spaNavigate = function (href) { navigate(href); };

  enhanceLinks();
  runPageInits(currentPageFromLocation());
})();
