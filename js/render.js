// Rysowanie planszy na <canvas>: ściany, ślad, podpowiedź, rozwiązanie, gracz, meta, konfetti.
(function (global) {
  'use strict';

  var MOVE_ANIM_MS = 80;
  var BUMP_ANIM_MS = 120;
  var CONFETTI_MS = 1800;
  var SOLUTION_DRAW_MS = 1100; // czas "rysowania" drogi po poddaniu się
  var HINT_STAGGER_MS = 70;    // kolejne pola podpowiedzi pojawiają się falą
  var RIPPLE_MS = 900;

  var reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 0;
    this.dpr = 1;
    this.cell = 0;
    this.pad = 0;
    this.colors = {};
    this.anim = null;
    this.bumpAnim = null;
    this.confetti = [];
    this.winAt = 0;
    this.solutionAt = 0;
    this.hintAt = 0;
    this.lastHintUntil = 0;
    this.lastFrame = 0;
    this.readColors();

    var self = this;
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { self.readColors(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  // Kolory bierzemy ze zmiennych CSS, więc motyw jasny/ciemny ustawia się w jednym miejscu.
  Renderer.prototype.readColors = function () {
    var s = getComputedStyle(document.documentElement);
    var names = ['board', 'wall', 'player', 'goal', 'trail'];
    for (var i = 0; i < names.length; i++) {
      this.colors[names[i]] = s.getPropertyValue('--' + names[i]).trim() || '#888';
    }
  };

  // Plansza jest kwadratem wpisanym w dostępne miejsce – bez przewijania.
  Renderer.prototype.resize = function () {
    var wrap = this.canvas.parentElement;
    var rect = wrap.getBoundingClientRect();
    var size = Math.max(120, Math.floor(Math.min(rect.width, rect.height)));
    this.dpr = global.devicePixelRatio || 1;
    this.size = size;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
  };

  Renderer.prototype.reset = function (game) {
    var p = game.player;
    this.anim = { fx: p.x, fy: p.y, tx: p.x, ty: p.y, t0: 0, dx: 0, dy: 0 };
    this.bumpAnim = null;
    this.confetti = [];
    this.winAt = 0;
    this.solutionAt = 0;
    this.hintAt = 0;
    this.lastHintUntil = 0;
  };

  Renderer.prototype.layout = function (game) {
    this.pad = Math.max(6, Math.round(this.size * 0.03));
    this.cell = (this.size - 2 * this.pad) / game.size;
  };

  Renderer.prototype.cx = function (x) { return this.pad + (x + 0.5) * this.cell; };
  Renderer.prototype.cy = function (y) { return this.pad + (y + 0.5) * this.cell; };

  // Płynne przejście gracza z poprzedniego pola na nowe (ok. 80 ms).
  Renderer.prototype.playerPos = function (game, now) {
    var p = game.player;
    var a = this.anim;
    if (a.tx !== p.x || a.ty !== p.y) {
      var cur = this.interp(now);
      this.anim = a = { fx: cur.x, fy: cur.y, tx: p.x, ty: p.y, t0: now, dx: p.x - a.tx, dy: p.y - a.ty };
    }
    return this.interp(now);
  };

  Renderer.prototype.interp = function (now) {
    var a = this.anim;
    var k = Math.min(1, Math.max(0, (now - a.t0) / MOVE_ANIM_MS));
    var e = 1 - (1 - k) * (1 - k); // ease-out
    return { x: a.fx + (a.tx - a.fx) * e, y: a.fy + (a.ty - a.fy) * e, k: k };
  };

  // Krótkie "odbicie" gracza przy uderzeniu w ścianę.
  Renderer.prototype.bump = function (dir, now) {
    this.bumpAnim = { d: Maze.DIRS[dir], t0: now };
  };

  Renderer.prototype.startConfetti = function (game, now) {
    var colors = [this.colors.player, this.colors.goal, this.colors.trail, this.colors.wall];
    this.layout(game);
    this.winAt = now;
    if (reducedMotion) return;
    var ox = this.cx(game.goal.x), oy = this.cy(game.goal.y);
    this.confetti = [];
    for (var i = 0; i < 140; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      var speed = this.size * (0.5 + Math.random() * 0.9);
      this.confetti.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed - speed * 0.35,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 3,
        round: Math.random() < 0.3,
        color: colors[i % colors.length],
        born: now
      });
    }
  };

  Renderer.prototype.draw = function (game, now) {
    var ctx = this.ctx;
    var dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;

    this.layout(game);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size);
    this.drawBoard(game);

    var pos = this.playerPos(game, now);

    // Moment pojawienia się podpowiedzi / rozwiązania – do animacji wejścia.
    if (game.hintUntil !== this.lastHintUntil) { this.lastHintUntil = game.hintUntil; this.hintAt = now; }
    if (game.solution && !this.solutionAt) this.solutionAt = now;

    this.drawStart(game);
    this.drawGoalGlow(game, now);
    if (game.hintVisible(now)) this.drawHint(game, now);
    this.drawTrail(game, pos);
    if (game.solution) this.drawSolution(game, now);
    this.drawWalls(game);
    this.drawGoal(game, now);
    if (this.winAt) this.drawRipple(game, now);
    this.drawPlayer(pos, now);
    if (this.confetti.length) this.drawConfetti(now, dt);
  };

  // Papier z siatką kropek w narożnikach pól – jak w zeszycie.
  Renderer.prototype.drawBoard = function (game) {
    var ctx = this.ctx, c = this.cell, pad = this.pad, n = game.size;
    ctx.fillStyle = this.colors.board;
    ctx.fillRect(0, 0, this.size, this.size);
    if (c < 9) return;
    ctx.save();
    ctx.fillStyle = this.colors.wall;
    ctx.globalAlpha = 0.13;
    var r = Math.max(0.8, c * 0.045);
    ctx.beginPath();
    for (var y = 1; y < n; y++) {
      for (var x = 1; x < n; x++) {
        ctx.moveTo(pad + x * c + r, pad + y * c);
        ctx.arc(pad + x * c, pad + y * c, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.wallPath = function (game) {
    var ctx = this.ctx, maze = game.maze, c = this.cell, pad = this.pad;
    ctx.beginPath();
    for (var y = 0; y < maze.height; y++) {
      for (var x = 0; x < maze.width; x++) {
        var x0 = pad + x * c, y0 = pad + y * c;
        // Każdą ścianę rysujemy raz: górną i lewą tylko na krawędzi planszy.
        if (y === 0 && Maze.hasWall(maze, x, y, 'up')) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + c, y0); }
        if (x === 0 && Maze.hasWall(maze, x, y, 'left')) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + c); }
        if (Maze.hasWall(maze, x, y, 'down')) { ctx.moveTo(x0, y0 + c); ctx.lineTo(x0 + c, y0 + c); }
        if (Maze.hasWall(maze, x, y, 'right')) { ctx.moveTo(x0 + c, y0); ctx.lineTo(x0 + c, y0 + c); }
      }
    }
  };

  Renderer.prototype.drawWalls = function (game) {
    var ctx = this.ctx, c = this.cell;
    var w = Math.max(1.6, c * 0.11);
    this.wallPath(game);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Miękki cień pod atramentem daje ścianom lekką głębię.
    ctx.save();
    ctx.translate(0, Math.max(1, c * 0.06));
    ctx.strokeStyle = this.colors.wall;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = w * 1.8;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = this.colors.wall;
    ctx.lineWidth = w;
    ctx.stroke();
  };

  Renderer.prototype.polyline = function (cells, last, count) {
    var ctx = this.ctx;
    var n = count === undefined ? cells.length : count;
    ctx.beginPath();
    ctx.moveTo(this.cx(cells[0].x), this.cy(cells[0].y));
    for (var i = 1; i < n; i++) ctx.lineTo(this.cx(cells[i].x), this.cy(cells[i].y));
    if (last) ctx.lineTo(this.cx(last.x), this.cy(last.y));
  };

  // Znacznik startu: przerywany pierścień w narożniku.
  Renderer.prototype.drawStart = function (game) {
    var ctx = this.ctx, c = this.cell;
    ctx.save();
    ctx.strokeStyle = this.colors.player;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.setLineDash([c * 0.12, c * 0.1]);
    ctx.beginPath();
    ctx.arc(this.cx(game.start.x), this.cy(game.start.y), c * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawTrail = function (game, pos) {
    var trail = game.trail;
    if (trail.length < 2 && pos.x === trail[0].x && pos.y === trail[0].y) return;
    var ctx = this.ctx;
    var cells = trail.length > 1 ? trail.slice(0, -1) : trail;
    ctx.save();
    ctx.strokeStyle = this.colors.trail;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.cell * 0.24;
    // Cała droga bledsza, ostatnie kroki wyraźniejsze – widać kierunek marszu.
    ctx.globalAlpha = 0.28;
    this.polyline(cells, pos);
    ctx.stroke();
    var recent = cells.slice(Math.max(0, cells.length - 8));
    ctx.globalAlpha = 0.35;
    this.polyline(recent, pos);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawHint = function (game, now) {
    var ctx = this.ctx, c = this.cell;
    var age = now - this.hintAt;
    var left = game.hintUntil - now;
    var fadeOut = Math.min(1, left / 300);
    ctx.save();
    for (var i = 0; i < game.hintCells.length; i++) {
      var h = game.hintCells[i];
      var appear = Math.min(1, Math.max(0, (age - i * HINT_STAGGER_MS) / 180));
      if (appear <= 0) continue;
      var pulse = 0.75 + 0.25 * Math.sin(now / 140 - i * 0.8);
      var s = (0.55 + 0.45 * appear) * (c * 0.72);
      var x = this.cx(h.x) - s / 2, y = this.cy(h.y) - s / 2;
      ctx.globalAlpha = appear * fadeOut * pulse * (0.55 - i * 0.07);
      ctx.fillStyle = this.colors.trail;
      roundRect(ctx, x, y, s, s, s * 0.28);
      ctx.fill();
      ctx.globalAlpha = appear * fadeOut * 0.9;
      ctx.strokeStyle = this.colors.trail;
      ctx.lineWidth = Math.max(1, c * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Droga do mety "rysuje się" od startu, potem kreski powoli płyną.
  Renderer.prototype.drawSolution = function (game, now) {
    var ctx = this.ctx, c = this.cell, sol = game.solution;
    var k = reducedMotion ? 1 : Math.min(1, (now - this.solutionAt) / SOLUTION_DRAW_MS);
    k = 1 - Math.pow(1 - k, 3);
    var f = k * (sol.length - 1);
    var whole = Math.floor(f);
    var tip = null;
    if (whole < sol.length - 1) {
      var a = sol[whole], b = sol[whole + 1], t = f - whole;
      tip = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.colors.goal;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = c * 0.42;
    this.polyline(sol, tip, whole + 1);
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(2, c * 0.13);
    ctx.setLineDash([c * 0.28, c * 0.22]);
    ctx.lineDashOffset = reducedMotion ? 0 : -now / 40;
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawGoalGlow = function (game, now) {
    var ctx = this.ctx, c = this.cell;
    var x = this.cx(game.goal.x), y = this.cy(game.goal.y);
    var pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 500);
    var r = c * (0.75 + 0.15 * pulse);
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, this.colors.goal);
    g.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.12 * pulse;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  Renderer.prototype.drawGoal = function (game, now) {
    var ctx = this.ctx, c = this.cell;
    var x = this.cx(game.goal.x), y = this.cy(game.goal.y);
    var rot = reducedMotion ? 0 : now / 2600;
    var r = c * 0.36;
    if (this.winAt) {
      var k = Math.min(1, (now - this.winAt) / 400);
      r *= 1 + 0.35 * Math.sin(k * Math.PI);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    starPath(ctx, r, r * 0.46);
    ctx.shadowColor = this.colors.goal;
    ctx.shadowBlur = c * 0.35;
    ctx.fillStyle = this.colors.goal;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Jaśniejszy środek – gwiazdka wygląda na błyszczącą.
    starPath(ctx, r * 0.5, r * 0.23);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  };

  // Rozchodzące się kręgi z mety po wygranej.
  Renderer.prototype.drawRipple = function (game, now) {
    var ctx = this.ctx, c = this.cell;
    var x = this.cx(game.goal.x), y = this.cy(game.goal.y);
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var k = (now - this.winAt - i * 160) / RIPPLE_MS;
      if (k <= 0 || k >= 1) continue;
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = i === 1 ? this.colors.trail : this.colors.goal;
      ctx.lineWidth = Math.max(1.5, c * 0.12 * (1 - k));
      ctx.beginPath();
      ctx.arc(x, y, c * (0.4 + k * 3.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype.drawPlayer = function (pos, now) {
    var ctx = this.ctx, c = this.cell;
    var x = this.cx(pos.x), y = this.cy(pos.y);
    var b = this.bumpAnim;
    var sx = 1, sy = 1;
    if (b) {
      var k = (now - b.t0) / BUMP_ANIM_MS;
      if (k >= 1) {
        this.bumpAnim = null;
      } else {
        var s = Math.sin(k * Math.PI);
        x += b.d.dx * s * c * 0.12;
        y += b.d.dy * s * c * 0.12;
        // Spłaszczenie przy zderzeniu ze ścianą.
        sx -= Math.abs(b.d.dx) * s * 0.18; sy += Math.abs(b.d.dx) * s * 0.1;
        sy -= Math.abs(b.d.dy) * s * 0.18; sx += Math.abs(b.d.dy) * s * 0.1;
      }
    }
    // Rozciągnięcie w kierunku ruchu w trakcie przesuwania.
    if (!reducedMotion && pos.k < 1) {
      var st = Math.sin(pos.k * Math.PI) * 0.16;
      var a = this.anim;
      sx += Math.abs(a.dx) * st - Math.abs(a.dy) * st * 0.5;
      sy += Math.abs(a.dy) * st - Math.abs(a.dx) * st * 0.5;
    }
    var r = c * 0.31;

    ctx.save();
    // Cień pod pionkiem
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = this.colors.wall;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.55, r * 0.95 * sx, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(x, y);
    ctx.scale(sx, sy);
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, lighten(this.colors.player, 0.35));
    g.addColorStop(1, this.colors.player);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Połysk
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawConfetti = function (now, dt) {
    var ctx = this.ctx;
    var gravity = this.size * 1.4;
    var alive = [];
    for (var i = 0; i < this.confetti.length; i++) {
      var p = this.confetti[i];
      var age = now - p.born;
      if (age > CONFETTI_MS) continue;
      p.vy += gravity * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (CONFETTI_MS - age) / 400);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.h * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Skalowanie w poziomie udaje obracanie się paska papieru.
        ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
      alive.push(p);
    }
    this.confetti = alive;
  };

  function starPath(ctx, r, inner) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : inner;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Rozjaśnia kolor #rrggbb w stronę bieli (0..1).
  function lighten(hex, amt) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  Renderer.starPath = starPath;
  Renderer.lighten = lighten;
  global.Renderer = Renderer;
})(window);
