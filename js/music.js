(function () {
  /*
   * The turntable's player, under the record in the sidebar: cover, title and artist (sliding sideways when
   * they don't fit), play / pause (songs are picked from the list), a progress bar, volume, and the
   * playlist folded away below.
   * The sound comes from YouTube: a player kept out of sight and driven through YouTube's iframe API,
   * which (unlike Spotify's) lets the page set the volume. The songs are listed in js/playlist.js.
   * The sidebar stays put when spa.js changes pages, so the music keeps going.
   */
  var PL = window.PLAYLIST;
  var sidebar = document.querySelector('.sidebar');
  var logo = sidebar && sidebar.querySelector('.sidebar-logo');
  if (!PL || !PL.tracks.length || !logo) return;

  var tracks = PL.tracks;

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  var ICON = {
    play: '<svg viewBox="0 0 10 10"><path d="M2 1v8l7-4z"/></svg>',
    pause: '<svg viewBox="0 0 10 10"><rect x="2" y="1.2" width="2.1" height="7.6"/><rect x="5.9" y="1.2" width="2.1" height="7.6"/></svg>',
    // a small speaker; the waves go when muted
    vol: '<svg viewBox="0 0 12 10"><path class="mu-spk" d="M1 3.5h2L6 1v8L3 6.5H1z"/><path class="mu-wave" d="M8 3.2c.7.9.7 2.7 0 3.6M9.6 1.8c1.4 1.7 1.4 4.7 0 6.4"/></svg>'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function clock(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  var el = document.createElement('div');
  el.className = 'music';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Music player');
  el.innerHTML =
    '<div class="mu-now">' +
    '<img class="mu-cover" alt="" width="36" height="36">' +
    '<div class="mu-meta">' +
    '<div class="mu-line mu-title"><span class="mu-run"></span></div>' +
    '<div class="mu-line mu-artist"><span class="mu-run"></span></div>' +
    '</div>' +
    '<div class="mu-ctrl">' +
    '<button type="button" class="mu-btn mu-play" data-mu="play" aria-label="Play">' + ICON.play + '</button>' +
    '</div>' +
    '</div>' +
    '<div class="mu-bar mu-seek" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">' +
    '<span class="mu-fill"></span>' +
    '</div>' +
    '<div class="mu-foot">' +
    '<button type="button" class="mu-toggle" aria-expanded="false">playlist <span class="mu-count">' + tracks.length + '</span><span class="mu-chev" aria-hidden="true"></span></button>' +
    '<span class="mu-vol">' +
    '<button type="button" class="mu-mute" data-mu="mute" aria-label="Mute">' + ICON.vol + '</button>' +
    '<span class="mu-bar mu-level" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100"><span class="mu-fill"></span></span>' +
    '</span>' +
    '<span class="mu-time">0:00</span>' +
    '</div>' +
    '<div class="mu-drawer"><div class="mu-drawer-in">' +
    '<ol class="mu-list">' +
    tracks.map(function (t, i) {
      return '<li><button type="button" data-i="' + i + '">' +
        '<span class="mu-n">' + (i + 1) + '</span>' +
        '<span class="mu-lt">' + esc(t.t) + '</span>' +
        '<span class="mu-la">' + esc(t.a) + '</span>' +
        '</button></li>';
    }).join('') +
    '</ol>' +
    // credit where it's due: the music is Nexon's, the recordings are theirs and SlipySlidy's
    '<p class="mu-credit">Music from MapleStory \u00a9 <a href="https://maplestory.nexon.net" target="_blank" rel="noopener">NEXON</a>. ' +
    'Soundtracks by <a href="https://www.youtube.com/@NECORDMUSIC" target="_blank" rel="noopener">NECORD MUSIC</a>; ' +
    'in-game recordings by <a href="https://www.youtube.com/@SlipySlidy" target="_blank" rel="noopener">SlipySlidy</a>, played from YouTube. ' +
    'Not affiliated with or endorsed by Nexon.</p>' +
    '</div></div>';
  logo.insertAdjacentElement('afterend', el);

  var $ = function (s) { return el.querySelector(s); };
  var coverImg = $('.mu-cover'), titleLine = $('.mu-title'), artistLine = $('.mu-artist');
  var playBtn = $('.mu-play'), seekBar = $('.mu-seek'), seekFill = seekBar.firstChild, timeEl = $('.mu-time');
  var levelBar = $('.mu-level'), levelFill = levelBar.firstChild, muteBtn = $('.mu-mute');
  var toggle = $('.mu-toggle'), list = $('.mu-list');

  var index = Math.min(tracks.length - 1, Math.max(0, parseInt(load('music-track', 0), 10) || 0));
  // the slider's position; the sound level is its square, so the quiet end has room to be set finely
  var level = parseFloat(load('music-volume', 0.45));
  if (!(level >= 0 && level <= 1)) level = 0.45;
  var muted = false;

  // playback state, as last read from the player (seconds)
  var playing = false, pos = 0, dur = tracks[index].d, stamp = 0;
  var dragging = null;

  /* ── now playing ───────────────────────── */

  function setLine(line, text) {
    line.dataset.text = text;
    line.title = text;
    fit(line);
  }

  // too long for its box: show it twice, a gap apart, and slide one copy's width, so it loops seamlessly.
  // Measured again whenever the box changes size (the phone bar, a rotated phone, the font arriving),
  // so a title that fits never slides just because it was measured before the layout settled.
  function fit(line) {
    var run = line.querySelector('.mu-run'), text = line.dataset.text || '';
    line.classList.remove('is-sliding');
    run.textContent = text;
    var room = line.clientWidth;
    if (!room) return; // not laid out yet (hidden); the resize watcher will measure it once it is
    var w = run.scrollWidth;
    if (w <= room + 1) return;
    var gap = 24;
    run.innerHTML = '<span>' + esc(text) + '</span><span aria-hidden="true">' + esc(text) + '</span>';
    run.style.setProperty('--mu-gap', gap + 'px');
    run.style.setProperty('--mu-shift', -(w + gap) + 'px');
    run.style.setProperty('--mu-time', ((w + gap) / 22 + 2.4).toFixed(2) + 's'); // ~22px/s, plus a rest at the start
    line.classList.add('is-sliding');
  }
  function refit() { fit(titleLine); fit(artistLine); }
  var lastRoom = -1;
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var room = titleLine.clientWidth;
      if (room !== lastRoom) { lastRoom = room; refit(); }
    }).observe(titleLine);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

  function showTrack() {
    var t = tracks[index];
    coverImg.src = t.c || '';
    setLine(titleLine, t.t);
    setLine(artistLine, t.a);
    var cur = list.querySelector('.is-current');
    if (cur) cur.classList.remove('is-current');
    list.children[index].firstChild.classList.add('is-current');
    save('music-track', index);
  }

  function showPlaying() {
    playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    el.classList.toggle('is-playing', playing);
    document.documentElement.classList.toggle('music-on', playing);
  }

  function now() {
    return Math.min(dur, playing && dragging !== seekBar ? pos + (performance.now() - stamp) / 1000 : pos);
  }

  function paint() {
    var p = now();
    seekFill.style.transform = 'scaleX(' + (dur ? p / dur : 0) + ')';
    timeEl.textContent = clock(p) + ' / ' + clock(dur);
    seekBar.setAttribute('aria-valuemax', Math.round(dur));
    seekBar.setAttribute('aria-valuenow', Math.round(p));
    seekBar.setAttribute('aria-valuetext', clock(p) + ' of ' + clock(dur));
  }

  // YouTube doesn't report progress on its own: read it every half second while playing, and run the bar
  // smoothly from our own clock in between
  var lastSync = 0;
  function tick(t) {
    if (!playing) return;
    if (t - lastSync > 500) { lastSync = t; sync(); }
    paint();
    requestAnimationFrame(tick);
  }
  function sync() {
    pos = player.getCurrentTime() || 0;
    var d = player.getDuration();
    if (d) dur = d;
    stamp = performance.now();
  }
  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    showPlaying();
    if (on) requestAnimationFrame(tick);
  }

  /* ── volume ────────────────────────────── */

  function applyVolume() {
    if (!ready) return;
    var v = muted ? 0 : Math.round(level * level * 100);
    if (v === 0) player.mute(); else { player.unMute(); player.setVolume(v); }
  }
  function showLevel() {
    var shown = muted ? 0 : level;
    levelFill.style.transform = 'scaleX(' + shown + ')';
    levelBar.setAttribute('aria-valuenow', Math.round(shown * 100));
    el.classList.toggle('is-muted', muted || level === 0);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    applyVolume();
  }
  function setLevel(v) {
    level = Math.max(0, Math.min(1, v));
    muted = false;
    save('music-volume', level.toFixed(3));
    showLevel();
  }

  /* ── the hidden YouTube player ─────────── */

  var player = null, ready = false, booting = false, loaded = -1, wantPlay = false;

  function boot() {
    if (booting) return;
    booting = true;
    var host = document.createElement('div');
    host.className = 'mu-embed';
    host.setAttribute('aria-hidden', 'true');
    var target = document.createElement('div');
    host.appendChild(target);
    document.body.appendChild(host);

    var prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (prior) prior();
      player = new YT.Player(target, {
        width: 200,
        height: 200,
        host: 'https://www.youtube-nocookie.com',
        videoId: tracks[index].yt,
        playerVars: { controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0 },
        events: {
          onReady: function () {
            ready = true;
            loaded = index;
            var frame = player.getIframe();
            frame.tabIndex = -1;
            frame.title = 'Music';
            applyVolume();
            if (wantPlay) { wantPlay = false; player.playVideo(); }
          },
          onStateChange: function (e) {
            var s = e.data;
            if (s === YT.PlayerState.ENDED) { go(index + 1, true); return; }
            if (s === YT.PlayerState.PLAYING) { sync(); setPlaying(true); }
            else if (s === YT.PlayerState.PAUSED) { sync(); setPlaying(false); paint(); }
          },
          // the video's gone or can't be embedded: skip it rather than sit silent
          onError: function () { if (playing || wantPlay) go(index + 1, true); }
        }
      });
    };
    if (window.YT && window.YT.Player) { window.onYouTubeIframeAPIReady(); return; }
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  }

  // switch to track i; play it if asked
  function go(i, play) {
    index = (i + tracks.length) % tracks.length;
    pos = 0; dur = tracks[index].d; stamp = performance.now();
    setPlaying(false);
    showTrack();
    paint();
    if (!ready) { wantPlay = play; boot(); return; }
    loaded = index;
    if (play) player.loadVideoById(tracks[index].yt);
    else player.cueVideoById(tracks[index].yt);
  }

  function playPause() {
    if (!ready) { wantPlay = !wantPlay; boot(); return; }
    if (loaded !== index) { go(index, true); return; }
    if (playing) player.pauseVideo(); else player.playVideo();
  }

  function seek(s) {
    if (ready && loaded === index) player.seekTo(s, true);
  }

  el.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.dataset.mu;
    if (act === 'play') playPause();
    else if (act === 'mute') { muted = !muted; showLevel(); }
    else if (b.dataset.i != null) go(+b.dataset.i, true);
    else if (b === toggle) openList(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // on a phone the open playlist covers the page, so a tap anywhere else folds it away
  var phone = window.matchMedia('(max-width: 600px)');
  document.addEventListener('click', function (e) {
    if (phone.matches && el.classList.contains('is-open') && !el.contains(e.target)) openList(false);
  });

  function openList(open) {
    toggle.setAttribute('aria-expanded', open);
    el.classList.toggle('is-open', open);
    if (open) {
      // bring the current song into view inside the list, without moving the page
      // (the drawer is still unfolding, so aim for a row near the top rather than the middle)
      var cur = list.querySelector('.is-current');
      if (cur) list.scrollTop = cur.parentNode.offsetTop - cur.offsetHeight * 1.5;
    }
  }

  /* ── the two sliders: seek and volume ──── */

  function fraction(bar, clientX) {
    var r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }
  function slide(bar, clientX, commit) {
    var f = fraction(bar, clientX);
    if (bar === levelBar) { setLevel(f); return; }
    pos = f * dur;
    stamp = performance.now();
    paint();
    if (commit) seek(pos);
  }
  [seekBar, levelBar].forEach(function (bar) {
    bar.addEventListener('pointerdown', function (e) {
      dragging = bar;
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('is-drag');
      slide(bar, e.clientX, false);
    });
    bar.addEventListener('pointermove', function (e) { if (dragging === bar) slide(bar, e.clientX, false); });
    function end(e) {
      if (dragging !== bar) return;
      dragging = null;
      bar.classList.remove('is-drag');
      slide(bar, e.clientX, true);
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  });
  seekBar.addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    pos = Math.max(0, Math.min(dur, now() + step));
    stamp = performance.now();
    seek(pos);
    paint();
  });
  levelBar.addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
    if (!step) return;
    e.preventDefault();
    setLevel(level + step);
  });

  showTrack();
  showLevel();
  showPlaying();
  paint();

  // warm the player up once the page has settled, or as soon as the pointer comes near
  el.addEventListener('pointerenter', boot, { once: true });
  el.addEventListener('focusin', boot, { once: true });
  window.addEventListener('load', function () { setTimeout(boot, 2500); });
})();
