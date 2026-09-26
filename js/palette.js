(function () {
  /* ⌘K / ctrl-K / "/" command palette. */
  var EMAIL = 'nguyenkn@umich.edu';

  function go(href) {
    return function () {
      if (typeof window.spaNavigate === 'function') window.spaNavigate(href);
      else window.location.href = href;
    };
  }

  function openUrl(url) {
    return function () { window.open(url, '_blank', 'noopener'); };
  }

  var COMMANDS = [
    { label: 'about', hint: 'top of page', run: go('index.html') },
    { label: 'projects', hint: 'section', run: go('index.html#projects') },
    { label: 'gallery', hint: 'section', run: go('index.html#gallery') },
    { label: 'publications', hint: 'section', run: go('index.html#publications') },
    { label: 'waveform', hint: 'page', run: go('waveform.html') },
    { label: 'resume', hint: 'page', run: go('resume.html') },
    { label: 'contact', hint: 'page', run: go('contact.html') },
    { label: 'pomodoro', hint: 'focus timer', run: go('pomodoro.html') },
    { label: 'flappy', hint: 'play a game', run: go('flappy.html') },
    { label: 'surprise me', hint: 'page', run: go('surprise.html') },
    { label: 'ritsu shimmer', hint: 'full-screen shader', run: function () { window.location.href = 'shimmer.html'; } },
    { label: 'toggle crystals', hint: 'background on / off', run: function () {
      if (window.crystals) toast(window.crystals.toggle() ? 'crystals on' : 'crystals off');
    } },
    { label: 'toggle theme', hint: 'light / dark', run: function () { window.toggleTheme && window.toggleTheme(); } },
    { label: 'copy email', hint: EMAIL, run: function () {
      var done = function () { toast('copied ' + EMAIL); };
      if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(done, function () { toast(EMAIL); });
      else toast(EMAIL);
    } },
    { label: 'github', hint: 'external', run: openUrl('https://github.com/nunuduk') },
    { label: 'linkedin', hint: 'external', run: openUrl('https://www.linkedin.com/in/nguyen325/') }
  ];

  /* typed exactly, these do something instead of matching a command */
  var SECRETS = {
    'sudo make me a phd': 'permission granted. see you in 5–6 years.',
    'make': 'make: *** No targets specified and no makefile found.  Stop.',
    'ls': 'about  projects  gallery  publications  waveform  resume  contact',
    'hello': 'hi :)',
    'rm -rf /': 'nice try.',
    'vim': 'you are now trapped. just kidding. esc works.',
    'coffee': 'charge. hold. recover. wait. repeat.'
  };

  var el, input, list, items = [], sel = 0;

  function build() {
    el = document.createElement('div');
    el.className = 'palette';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'command palette');
    el.innerHTML =
      '<div class="palette-box">' +
      '<input class="palette-input" id="palette-input" type="text" placeholder="jump to…" autocomplete="off" spellcheck="false">' +
      '<ul class="palette-list" role="listbox"></ul>' +
      '<div class="palette-foot"><span>↑↓ select</span><span>↵ run</span><span>esc close</span></div>' +
      '</div>';
    document.body.appendChild(el);
    input = el.querySelector('input');
    list = el.querySelector('ul');

    el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
    input.addEventListener('input', function () { sel = 0; filter(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
      else if (e.key === 'Enter') { runSelected(); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); e.preventDefault(); }
    });
  }

  function score(label, q) {
    if (!q) return 1;
    var i = label.indexOf(q);
    if (i === 0) return 100;
    if (i > 0) return 50 - i;
    var j = 0;
    for (var k = 0; k < label.length && j < q.length; k++) if (label[k] === q[j]) j++;
    return j === q.length ? 10 : 0;
  }

  function filter() {
    var q = input.value.trim().toLowerCase();
    items = COMMANDS
      .map(function (c) { return { c: c, s: score(c.label, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.c; });
    if (SECRETS[q]) items.unshift({ label: q, hint: 'run', run: function () { toast(SECRETS[q]); } });
    paint();
  }

  function paint() {
    if (!items.length) {
      list.innerHTML = '<li class="palette-empty">no match. try “ls”.</li>';
      return;
    }
    list.innerHTML = items.map(function (c, i) {
      return '<li role="option" data-i="' + i + '"' + (i === sel ? ' class="is-sel" aria-selected="true"' : '') + '>' +
        '<span>' + c.label + '</span><span class="palette-hint">' + c.hint + '</span></li>';
    }).join('');
    list.querySelectorAll('li[data-i]').forEach(function (li) {
      li.addEventListener('mousemove', function () {
        var i = +li.dataset.i;
        if (i !== sel) { sel = i; paint(); }
      });
      li.addEventListener('click', function () { sel = +li.dataset.i; runSelected(); });
    });
    var cur = list.querySelector('.is-sel');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function runSelected() {
    var c = items[sel];
    if (!c) return;
    close();
    c.run();
  }

  function open() {
    if (!el) build();
    el.classList.add('open');
    input.value = '';
    sel = 0;
    filter();
    input.focus();
  }

  function close() {
    if (el) el.classList.remove('open');
  }

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'palette-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (el && el.classList.contains('open')) close(); else open();
    } else if (e.key === '/' && !typing) {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-palette-open]')) open();
  });

  window.openPalette = open;
})();
