// Podgląd w menu: mały labirynt, który sam się rozwiązuje. Używa tego samego renderera co gra.
(function (global) {
  'use strict';

  var STEP_MS = 170;       // tempo kroków "ducha"
  var PAUSE_AFTER_WIN = 1500;

  var reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function dirBetween(a, b) {
    if (b.x > a.x) return 'right';
    if (b.x < a.x) return 'left';
    if (b.y > a.y) return 'down';
    return 'up';
  }

  function MenuPreview(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.rafId = null;
    this.game = null;
    this.path = null;
    this.step = 0;
    this.nextAt = 0;
    var self = this;
    this.tick = function (now) { self.frame(now); };
  }

  MenuPreview.prototype.newMaze = function (now) {
    this.game = new Game('easy');
    this.path = Maze.solve(this.game.maze, this.game.start, this.game.goal);
    this.step = 1;
    this.nextAt = now + 600;
    this.renderer.reset(this.game);
  };

  MenuPreview.prototype.frame = function (now) {
    // Canvas ukryty (np. na małym ekranie) – nie rysujemy, ale sprawdzamy dalej.
    if (this.canvas.offsetWidth === 0) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }
    if (this.renderer.size !== Math.floor(this.canvas.parentElement.getBoundingClientRect().width)) {
      this.canvas.style.width = '';
      this.canvas.style.height = '';
      this.renderer.resize();
    }
    if (!this.game) this.newMaze(now);

    if (!reducedMotion && now >= this.nextAt) {
      if (this.game.status === 'won') {
        this.newMaze(now);
      } else {
        var from = this.path[this.step - 1], to = this.path[this.step];
        if (this.game.move(dirBetween(from, to), now) === 'won') {
          this.renderer.winAt = now;
          this.nextAt = now + PAUSE_AFTER_WIN;
        } else {
          this.step++;
          this.nextAt = now + STEP_MS;
        }
      }
    }

    this.renderer.draw(this.game, now);
    this.rafId = requestAnimationFrame(this.tick);
  };

  MenuPreview.prototype.start = function () {
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.tick);
  };

  MenuPreview.prototype.stop = function () {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  };

  global.MenuPreview = MenuPreview;
})(window);
