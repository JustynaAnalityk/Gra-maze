// Rysowanie planszy na <canvas>: ściany, ślad, podpowiedź, rozwiązanie, gracz, meta, konfetti.
(function (global) {
  'use strict';

  var MOVE_ANIM_MS = 80;
  var BUMP_ANIM_MS = 120;
  var CONFETTI_MS = 1800;

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
    this.anim = { fx: p.x, fy: p.y, tx: p.x, ty: p.y, t0: 0 };
    this.bumpAnim = null;
    this.confetti = [];
  };

  Renderer.prototype.layout = function (game) {
    this.pad = Math.max(4, Math.round(this.size * 0.02));
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
      this.anim = a = { fx: cur.x, fy: cur.y, tx: p.x, ty: p.y, t0: now };
    }
    return this.interp(now);
  };

  Renderer.prototype.interp = function (now) {
    var a = this.anim;
    var k = Math.min(1, Math.max(0, (now - a.t0) / MOVE_ANIM_MS));
    k = 1 - (1 - k) * (1 - k); // ease-out
    return { x: a.fx + (a.tx - a.fx) * k, y: a.fy + (a.ty - a.fy) * k };
  };

  // Krótkie "odbicie" gracza przy uderzeniu w ścianę.
  Renderer.prototype.bump = function (dir, now) {
    this.bumpAnim = { d: Maze.DIRS[dir], t0: now };
  };

  Renderer.prototype.startConfetti = function (game, now) {
    var colors = [this.colors.player, this.colors.goal, this.colors.trail, this.colors.wall];
    this.layout(game);
    var ox = this.cx(game.goal.x), oy = this.cy(game.goal.y);
    this.confetti = [];
    for (var i = 0; i < 110; i++) {
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      var speed = this.size * (0.5 + Math.random() * 0.9);
      this.confetti.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed - speed * 0.35,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        w: 4 + Math.random() * 5,
        h: 3 + Math.random() * 3,
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
    ctx.fillStyle = this.colors.board;
    ctx.fillRect(0, 0, this.size, this.size);

    var pos = this.playerPos(game, now);

    if (game.hintVisible(now)) this.drawHint(game, now);
    this.drawTrail(game, pos);
    if (game.solution) this.drawSolution(game);
    this.drawStar(this.cx(game.goal.x), this.cy(game.goal.y), this.cell * 0.36);
    this.drawWalls(game);
    this.drawPlayer(pos, now);
    if (this.confetti.length) this.drawConfetti(now, dt);
  };

  Renderer.prototype.drawWalls = function (game) {
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
    ctx.strokeStyle = this.colors.wall;
    ctx.lineWidth = Math.max(1.5, c * 0.1);
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  Renderer.prototype.polyline = function (cells, last) {
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.cx(cells[0].x), this.cy(cells[0].y));
    for (var i = 1; i < cells.length; i++) ctx.lineTo(this.cx(cells[i].x), this.cy(cells[i].y));
    if (last) ctx.lineTo(this.cx(last.x), this.cy(last.y));
  };

  Renderer.prototype.drawTrail = function (game, pos) {
    var trail = game.trail;
    if (trail.length < 2 && pos.x === trail[0].x && pos.y === trail[0].y) return;
    var ctx = this.ctx;
    ctx.save();
    // Ostatni punkt śladu podąża za animowaną pozycją gracza.
    this.polyline(trail.length > 1 ? trail.slice(0, -1) : trail, pos);
    ctx.strokeStyle = this.colors.trail;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = this.cell * 0.26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawHint = function (game, now) {
    var ctx = this.ctx, c = this.cell;
    var pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(now / 120));
    ctx.save();
    ctx.fillStyle = this.colors.trail;
    for (var i = 0; i < game.hintCells.length; i++) {
      var h = game.hintCells[i];
      // Dalsze pola podpowiedzi są nieco bledsze.
      ctx.globalAlpha = pulse * (1 - i * 0.12);
      var inset = c * 0.14;
      roundRect(ctx, this.pad + h.x * c + inset, this.pad + h.y * c + inset, c - 2 * inset, c - 2 * inset, c * 0.2);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawSolution = function (game) {
    var ctx = this.ctx;
    ctx.save();
    this.polyline(game.solution);
    ctx.strokeStyle = this.colors.goal;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(2, this.cell * 0.14);
    ctx.setLineDash([this.cell * 0.3, this.cell * 0.22]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawStar = function (x, y, r) {
    var ctx = this.ctx;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.colors.goal;
    ctx.fill();
  };

  Renderer.prototype.drawPlayer = function (pos, now) {
    var ctx = this.ctx;
    var x = this.cx(pos.x), y = this.cy(pos.y);
    var b = this.bumpAnim;
    if (b) {
      var k = (now - b.t0) / BUMP_ANIM_MS;
      if (k >= 1) {
        this.bumpAnim = null;
      } else {
        var off = Math.sin(k * Math.PI) * this.cell * 0.12;
        x += b.d.dx * off;
        y += b.d.dy * off;
      }
    }
    ctx.beginPath();
    ctx.arc(x, y, this.cell * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.player;
    ctx.fill();
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
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      alive.push(p);
    }
    this.confetti = alive;
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.Renderer = Renderer;
})(window);
