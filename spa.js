(function () {
  if (!window.history || !window.fetch || !window.DOMParser) return;

  var main = document.querySelector('main');
  if (!main) return;

  function currentPageFromLocation() {
    var path = window.location.pathname;
    var last = path.split('/').pop();
    return last && last.length ? last : 'index.html';
  }

  function isInternalHtmlLink(a) {
    if (!a || !a.getAttribute) return false;
    var href = a.getAttribute('href');
    if (!href) return false;
    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) return false;
    if (href.indexOf('mailto:') === 0 || href.indexOf('#') === 0) return false;
    if (!href.endsWith('.html')) return false;
    return true;
  }

  function setActiveNav(href) {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a');
    links.forEach(function (link) {
      var linkHref = link.getAttribute('href');
      link.classList.toggle('active', linkHref === href);
    });
  }

  function runPageInits(href) {
    var page = href || currentPageFromLocation();
    var last = page.split('/').pop();
    if (!last || !last.length) last = 'index.html';

    if (last === 'pomodoro.html' && typeof window.initPomodoro === 'function') {
      window.initPomodoro();
    } else if (last === 'surprise.html' && typeof window.initSurprise === 'function') {
      window.initSurprise();
    }
  }

  function enhanceLinks() {
    var links = document.querySelectorAll('a[href$=".html"]:not([data-no-spa])');
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
        loadPage(href);
      });
    });
  }

  async function loadPage(href, opts) {
    opts = opts || {};
    try {
      var res = await fetch(href, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var text = await res.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(text, 'text/html');
      var newMain = doc.querySelector('main');
      var newTitle = doc.querySelector('title');
      if (!newMain) return;

      main.replaceWith(newMain);
      main = newMain;

      if (newTitle && newTitle.textContent) {
        document.title = newTitle.textContent;
      }

      if (!opts.fromPopstate) {
        window.history.pushState({ href: href }, '', href);
      }

      setActiveNav(href);
      enhanceLinks();
      runPageInits(href);
    } catch (e) {
      console.error('SPA navigation failed, falling back to full load', e);
      window.location.href = href;
    }
  }

  window.addEventListener('popstate', function (event) {
    var href = (event.state && event.state.href) || currentPageFromLocation();
    loadPage(href, { fromPopstate: true });
  });

  enhanceLinks();
  runPageInits(currentPageFromLocation());
})();

