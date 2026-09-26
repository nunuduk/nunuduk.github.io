(function () {
  function toggleTheme() {
    var el = document.documentElement;
    var next = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    el.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    labelToggles();
  }

  // every theme button names the theme it switches to; the crystallize one adds its suffix (" 2")
  function labelToggles() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.textContent = (dark ? 'light' : 'dark') + (btn.dataset.suffix || '');
    });
  }

  window.toggleTheme = toggleTheme;

  document.addEventListener('DOMContentLoaded', labelToggles);
})();
