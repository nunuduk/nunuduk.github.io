(function () {
  /*
   * Tab icon: the sidebar record, simplified. A disc of the shimmer's rainbow sweep (no crystals), turning
   * at the record's 6 rpm while the bands drift like the shader's, with the purple label and spindle hole.
   * Drawn on a small canvas and swapped in as the favicon a dozen times a second (browsers don't animate
   * GIF favicons, except Firefox). Still under reduced motion; favicon.png without JS.
   */
  var link = document.querySelector('link[rel="icon"]');
  if (!link || !document.createElement('canvas').getContext) return;

  // the shader's 20-stop palette (holo.js STOPS)
  var STOPS = [
    [0.8337, 0.3580, 0.7086], [0.8349, 0.3494, 0.8105], [0.9192, 0.3398, 0.9300], [0.9067, 0.3304, 0.9507],
    [0.6761, 0.3228, 0.9597], [0.4930, 0.2396, 0.9672], [0.3675, 0.2346, 0.9660], [0.2979, 0.3798, 0.9644],
    [0.2616, 0.4883, 0.9723], [0.2921, 0.6630, 0.9874], [0.3160, 0.8321, 0.9963], [0.2766, 0.8566, 0.9755],
    [0.2497, 0.8375, 0.8719], [0.3384, 0.8891, 0.8264], [0.4029, 0.9171, 0.8840], [0.4017, 0.9442, 0.7516],
    [0.6308, 0.9925, 0.6860], [0.9226, 0.9749, 0.7033], [0.8734, 0.6812, 0.7194], [0.8466, 0.4564, 0.6598]
  ];
  function holo(h) {
    var x = (h - Math.floor(h)) * 20, i = Math.floor(x) % 20, j = (i + 1) % 20, f = x - Math.floor(x);
    f = f * f * (3 - 2 * f);
    var a = STOPS[i], b = STOPS[j];
    return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round((a[k] + (b[k] - a[k]) * f) * 255); }).join(',') + ')';
  }

  var S = 64, R = S / 2 - 1;                  // drawn at 64px, the browser scales it to the tab
  var SWEEP = 41.8 * Math.PI / 180;           // the shader's band angle
  var SPIN = 2 * Math.PI / 10;                // 6 rpm, like the record
  var c = document.createElement('canvas');
  c.width = c.height = S;
  var ctx = c.getContext('2d');

  function draw(t) {
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    // the rainbow: bands across the disc at the shader's angle, drifting, and the whole disc turning
    ctx.rotate(-t * SPIN + SWEEP);
    var g = ctx.createLinearGradient(-R, 0, R, 0);
    for (var k = 0; k <= 12; k++) g.addColorStop(k / 12, holo(k / 12 * 0.6 - t * 0.425 + 0.729));
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, S, S);
    ctx.restore();
    // label, its rim, and the spindle hole
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, R * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(204,184,247)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(158,133,219)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, R * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    // a thin dark edge so the disc reads on light and dark tab bars
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, R - 0.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    link.type = 'image/png';
    link.href = c.toDataURL('image/png');
  }

  // Keeps turning in background tabs too, which is where the icon is seen most (in the tab strip);
  // browsers slow timers there (Chrome to about once a second), so it steps instead of gliding.
  var t0 = performance.now();
  function tick() { draw((performance.now() - t0) / 1000 + 3); }
  tick();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(tick, 1000 / 12);
})();
