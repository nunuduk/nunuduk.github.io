(function () {
  var facts = [
    "what do i even put here",
    "i own exactly zero soldering irons. the lab has one.",
    "adiabatic means the energy comes back. i wish that worked for sleep.",
    "banana.",
    "my research is about making chips cooler. thermally and otherwise.",
    "the best part of chip design is when nothing is on fire.",
    "going to michigan. send help. "
  ];

  function initSurprise() {
    var factEl = document.getElementById('fact');
    if (!factEl) return;

    var current = Math.floor(Math.random() * facts.length);
    factEl.textContent = facts[current];

    window.nextFact = function () {
      current = (current + 1) % facts.length;
      factEl.textContent = facts[current];
    };
  }

  window.initSurprise = initSurprise;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSurprise);
  } else {
    initSurprise();
  }
})();

