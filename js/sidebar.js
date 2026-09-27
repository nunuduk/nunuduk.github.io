(function () {
  var root = document.getElementById('sidebar-root');
  if (!root) return;

  /* Edit this markup only — it is injected on every page. */
  var SIDEBAR_HTML =
    '<aside class="sidebar">' +
    '<div class="sidebar-logo" aria-hidden="true">' +
    '<span class="sidebar-logo-default">' +
    // a simple turntable: plinth (running off the left edge) and platter behind the record, tonearm in front.
    // Units: the record is 150 across, centred at 0,0.
    '<svg class="player-base" viewBox="-160 -110 280 220" aria-hidden="true">' +
    '<rect class="pl-body" x="-170" y="-100" width="268" height="200"/>' +
    '<circle class="pl-platter" r="80"/>' +
    '<circle class="pl-knob" cx="78" cy="80" r="7"/>' +
    '<circle class="pl-led" cx="58" cy="86" r="2.2"/>' +
    '</svg>' +
    '<canvas class="sidebar-holo" data-holo data-holo-shard="8" data-holo-rise="12" data-holo-frame="300" data-holo-supersample="2" data-holo-spin="6" data-holo-label="0.46" data-holo-ref-rem="8.8" aria-hidden="true"></canvas>' +
    // the name, curved around the inside edge of the label, turning with the record
    '<svg class="record-label" viewBox="-75 -75 150 150" aria-hidden="true">' +
    '<defs><path id="record-arc" d="M 0,-24.5 A 24.5,24.5 0 1,1 -0.01,-24.5"/></defs>' +
    // the arc is 154 around: the name takes 134 of it and the dot sits centred in the gap before it starts again
    '<text><textPath href="#record-arc" textLength="134" lengthAdjust="spacing">NGUYEN NGUYEN</textPath></text>' +
    '<text><textPath href="#record-arc" startOffset="144.5" text-anchor="middle">\u2022</textPath></text>' +
    '</svg>' +
    '<svg class="player-arm" viewBox="-160 -110 280 220" aria-hidden="true">' +
    '<line class="pl-arm" x1="80" y1="-80" x2="60" y2="-18"/>' +
    '<rect class="pl-head" x="52" y="-19" width="10" height="16" transform="rotate(-18 57 -11)"/>' +
    '<circle class="pl-pivot" cx="80" cy="-80" r="8"/>' +
    '</svg>' +
    '</span>' +
    '<span class="sidebar-logo-surprise">' +
    '<img src="assets/images/favicon.png" alt="Nguyen Nguyen" class="logo-light">' +
    '<img src="assets/images/logo-dark.png" alt="Nguyen Nguyen dark logo" class="logo-dark">' +
    '</span>' +
    '</div>' +
    '<nav class="sidebar-nav">' +
    '<ul>' +
    '<li><a href="index.html">about</a></li>' +
    '<li><a href="index.html#publications">publications</a></li>' +
    '<li><a href="index.html#projects">projects</a></li>' +
    '<li><a href="index.html#gallery">gallery</a></li>' +
    '<li><a href="contact.html">contact</a></li>' +
    '<li><a href="waveform.html">waveform</a></li>' +
    '<li><a href="resume.html">resume</a></li>' +
    '<li><a href="pomodoro.html">pomodoro</a></li>' +
    '<li class="nav-gap"></li>' +
    '<li><button class="theme-toggle" type="button" onclick="toggleTheme()">dark</button></li>' +
    '<li><button class="crystals-toggle" type="button" data-crystals-toggle>crystals on</button></li>' +
    '<li><button class="palette-open" type="button" data-palette-open><kbd>⌘K</kbd> jump</button></li>' +
    '</ul>' +
    '</nav>' +
    '</aside>';

  function currentPageFromLocation() {
    var path = window.location.pathname;
    var last = path.split('/').pop();
    return (last && last.length ? last : 'index.html') + window.location.hash;
  }

  function setActiveNav(href) {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a');
    var active = null;
    links.forEach(function (link) {
      var linkHref = link.getAttribute('href');
      var on = linkHref === href;
      link.classList.toggle('active', on);
      if (on) active = link;
    });
    moveCursor(active);
  }

  /* the accent square beside the active item */
  function moveCursor(link) {
    var cursor = document.querySelector('.nav-cursor');
    if (!cursor) return;
    if (!link) { cursor.classList.remove('is-on'); return; }
    var y = link.parentElement.offsetTop + link.offsetHeight / 2 - 2.5;
    cursor.style.setProperty('--y', y + 'px');
    cursor.classList.add('is-on');
  }

  /* on the landing page, highlight whichever section is under the top third of the screen */
  var spyTick = false;
  var spyLocked = false, unlockTimer = 0;

  // While a clicked link is smooth-scrolling, the cursor already points at the destination;
  // don't let the sections it passes on the way pull it back. Unlock once scrolling settles.
  function lockScrollSpy() {
    spyLocked = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(unlockScrollSpy, 1200); // fallback if nothing scrolls
  }
  function unlockScrollSpy() {
    if (!spyLocked) return;
    spyLocked = false;
    clearTimeout(unlockTimer);
    scrollSpy();
  }
  window.lockScrollSpy = lockScrollSpy;
  window.addEventListener('scrollend', unlockScrollSpy);

  function scrollSpy() {
    spyTick = false;
    if (spyLocked) return;
    var sections = document.querySelectorAll('main.landing section[id]');
    if (!sections.length) return;
    var line = window.innerHeight * 0.33;
    var current = null;
    sections.forEach(function (sec) {
      if (sec.getBoundingClientRect().top <= line) current = sec.id;
    });
    // at the very bottom a short last section can't reach the line; it's still the one you're on
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) current = sections[sections.length - 1].id;
    // the About link goes to the very top (name included), so it covers the header and the About section
    setActiveNav(!current || current === 'about' ? 'index.html' : 'index.html#' + current);
  }
  window.addEventListener('scroll', function () {
    if (spyLocked && !('onscrollend' in window)) {
      // no scrollend event: treat 150ms without scrolling as the end
      clearTimeout(unlockTimer);
      unlockTimer = setTimeout(unlockScrollSpy, 150);
    }
    if (!spyTick) { spyTick = true; requestAnimationFrame(scrollSpy); }
  }, { passive: true });

  root.outerHTML = SIDEBAR_HTML;
  var navList = document.querySelector('.sidebar-nav ul');
  if (navList) {
    var cursorEl = document.createElement('li');
    cursorEl.className = 'nav-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    navList.appendChild(cursorEl);
  }
  window.setActiveNav = setActiveNav;
  setActiveNav(currentPageFromLocation());
  scrollSpy();
  // place the cursor first, then let it animate from there on
  requestAnimationFrame(function () {
    var c = document.querySelector('.nav-cursor');
    if (c) c.classList.add('is-ready');
  });
})();
