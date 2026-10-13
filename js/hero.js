// Ilustracja w menu (img/hero-*.webp – labirynt z kłębkiem i bramą) i jej animacje na <canvas> nad obrazkiem:
// pulsująca poświata bramy, unoszący się złoty pył, błysk biegnący po nici i wędrujące plamy światła.
// Powolne przybliżanie i paralaksę robi CSS (zmienne --px/--py ustawiane tu przy ruchu myszy).
// Współrzędne poniżej są w pikselach wycinka 1041×909 (tools/obrazy.mjs, HERO_CROP).
(function (global) {
  'use strict';

  var IMAGE = { w: 1041, h: 909 };
  var BALL = { x: 100, y: 70 };
  var GATE = { x: 880, y: 690 };  // świecące wnętrze bramy
  // Nić od kłębka przez pętlę do bramy – punkty zdjęte z obrazka.
  var THREAD = [
    { x: 150, y: 105 }, { x: 178, y: 135 }, { x: 270, y: 145 }, { x: 300, y: 205 }, { x: 415, y: 213 },
    { x: 440, y: 250 }, { x: 438, y: 290 }, { x: 480, y: 305 }, { x: 525, y: 300 }, { x: 547, y: 270 },
    { x: 532, y: 247 }, { x: 522, y: 272 }, { x: 560, y: 292 }, { x: 600, y: 322 }, { x: 608, y: 390 },
    { x: 590, y: 410 }, { x: 485, y: 418 }, { x: 462, y: 450 }, { x: 470, y: 505 }, { x: 520, y: 525 },
    { x: 700, y: 522 }, { x: 722, y: 560 }, { x: 760, y: 640 }, { x: 800, y: 690 }, { x: 835, y: 722 },
    { x: 878, y: 712 }
  ];

  var FRAME_MS = 33;       // ok. 30 klatek/s
  var GLINT_EVERY = 7000;  // co ile ms błysk rusza od kłębka
  var GLINT_MS = 3600;     // ile trwa jego droga do bramy
  var DUST = 16;
  var PARALLAX_PX = 6;

  var reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function rand(n) {
    var s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // Długości odcinków nici – błysk ma iść równym krokiem, a nie skakać na długich odcinkach.
  var lengths = [0];
  for (var i = 1; i < THREAD.length; i++) {
    var dx = THREAD[i].x - THREAD[i - 1].x, dy = THREAD[i].y - THREAD[i - 1].y;
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  var total = lengths[lengths.length - 1];

  // Punkt na nici w ułamku k (0 = przy kłębku, 1 = w bramie) jej długości.
  function pointAt(k) {
    var d = clamp(k, 0, 1) * total;
    for (var j = 1; j < THREAD.length; j++) {
      if (d <= lengths[j]) {
        var t = (d - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
        return { x: THREAD[j - 1].x + (THREAD[j].x - THREAD[j - 1].x) * t, y: THREAD[j - 1].y + (THREAD[j].y - THREAD[j - 1].y) * t };
      }
    }
    return { x: THREAD[THREAD.length - 1].x, y: THREAD[THREAD.length - 1].y };
  }

  // ---- Rysowanie (w układzie obrazka) ----

  // Miękkie, ciepłe plamy światła wędrujące po papierze, jak słońce przez gałązkę oliwną.
  function drawLight(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    for (var k = 0; k < 3; k++) {
      var x = IMAGE.w * (0.3 + 0.35 * k + 0.12 * Math.sin(t / (9000 + k * 2300) + k * 2));
      var y = IMAGE.h * (0.35 + 0.25 * Math.cos(t / (11000 + k * 1700) + k));
      var r = 260 + 60 * k;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255, 236, 190, 0.22)');
      g.addColorStop(1, 'rgba(255, 236, 190, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function drawGateGlow(ctx, t) {
    var pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t / 850);
    var r = 62 + 14 * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(GATE.x, GATE.y, 0, GATE.x, GATE.y, r);
    g.addColorStop(0, 'rgba(255, 214, 120, ' + (0.32 + 0.22 * pulse) + ')');
    g.addColorStop(0.45, 'rgba(255, 170, 60, ' + (0.12 + 0.08 * pulse) + ')');
    g.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(GATE.x - r, GATE.y - r, r * 2, r * 2);
    ctx.restore();
  }

  // Złoty pył unosi się z bramy i gaśnie.
  function drawDust(ctx, t) {
    if (reducedMotion) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < DUST; k++) {
      var period = 3800 + rand(k) * 2800;
      var ph = ((t + rand(k + 40) * period) % period) / period;
      var x = GATE.x + (rand(k + 10) - 0.5) * 70 + Math.sin(t / 650 + k * 1.7) * 9;
      var y = GATE.y + 10 - ph * (120 + rand(k + 20) * 90);
      var a = Math.sin(ph * Math.PI) * (0.55 + 0.35 * rand(k + 30));
      ctx.fillStyle = 'rgba(255, 210, 120, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + rand(k + 5) * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Błysk biegnący po nici od kłębka do bramy – nić „prowadzi” do wyjścia.
  function drawGlint(ctx, t) {
    if (reducedMotion) return;
    var phase = t % GLINT_EVERY;
    if (phase > GLINT_MS) return;
    var k = phase / GLINT_MS;
    var fade = Math.min(1, k * 6, (1 - k) * 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var tail = 0; tail < 4; tail++) {
      var p = pointAt(k - tail * 0.012);
      var r = 16 - tail * 3;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(255, 225, 200, ' + (0.6 * fade / (tail + 1)).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255, 120, 100, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function paint(ctx, t) {
    ctx.clearRect(0, 0, IMAGE.w, IMAGE.h);
    if (!reducedMotion) drawLight(ctx, t);
    drawGateGlow(ctx, t);
    drawDust(ctx, t);
    drawGlint(ctx, t);
  }

  // ---- Pętla ----

  var frame = null;
  var canvas = null;
  var ctx = null;
  var running = false;
  var raf = null;
  var last = 0;
  var startedAt = null;
  var frames = 0;

  function resize() {
    var dpr = global.devicePixelRatio || 1;
    var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(w * dpr / IMAGE.w, 0, 0, h * dpr / IMAGE.h, 0, 0);
  }

  function draw(now) {
    if (startedAt === null) startedAt = now;
    paint(ctx, now - startedAt);
    frames++;
  }

  function schedule() {
    if (raf === null && running && !reducedMotion && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = null;
    if (!running) return;
    if (now - last >= FRAME_MS) {
      last = now;
      draw(now);
    }
    schedule();
  }

  // Paralaksa: obrazek przesuwa się o kilka pikseli za myszą.
  function onPointer(e) {
    if (!running || reducedMotion || e.pointerType !== 'mouse') return;
    var kx = e.clientX / global.innerWidth - 0.5, ky = e.clientY / global.innerHeight - 0.5;
    frame.style.setProperty('--px', (-kx * PARALLAX_PX).toFixed(2) + 'px');
    frame.style.setProperty('--py', (-ky * PARALLAX_PX).toFixed(2) + 'px');
  }

  function init() {
    if (ctx) return true;
    canvas = document.getElementById('hero-fx');
    if (!canvas || !canvas.getContext) return false;
    frame = canvas.closest('.hero-frame');
    ctx = canvas.getContext('2d');
    resize();
    global.addEventListener('resize', function () { resize(); if (running) draw(performance.now()); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && raf !== null) { cancelAnimationFrame(raf); raf = null; }
      else schedule();
    });
    document.addEventListener('pointermove', onPointer);
    return true;
  }

  function start() {
    if (running || !init()) return;
    running = true;
    resize(); // menu mogło być ukryte przy poprzednim pomiarze
    draw(performance.now());
    schedule();
  }

  function stop() {
    if (!running) return;
    running = false;
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }

  global.HeroFX = {
    IMAGE: IMAGE,
    BALL: BALL,
    GATE: GATE,
    THREAD: THREAD,
    pointAt: pointAt,
    start: start,
    stop: stop,
    isRunning: function () { return running; },
    frames: function () { return frames; }
  };
})(window);
