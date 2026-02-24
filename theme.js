(function () {
  function toggleTheme() {
    var el = document.documentElement;
    var next = el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    el.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    var btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = next === 'dark' ? 'light' : 'dark';
  }

  window.toggleTheme = toggleTheme;

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  });
})();
