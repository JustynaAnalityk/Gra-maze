// Stan jednej rozgrywki: pozycja gracza, ślad, ruchy, czas, podpowiedzi. Bez DOM.
(function (global) {
  'use strict';

  var DIFFICULTIES = {
    easy:   { label: 'Łatwy',  size: 10 },
    medium: { label: 'Średni', size: 18 },
    hard:   { label: 'Trudny', size: 28 }
  };

  var HINTS_PER_MAZE = 3;
  var HINT_LENGTH = 5;
  var HINT_DURATION = 2000;

  function now() {
    return global.performance ? global.performance.now() : Date.now();
  }

  function Game(difficulty, rng) {
    var cfg = DIFFICULTIES[difficulty];
    if (!cfg) throw new Error('Nieznany poziom trudności: ' + difficulty);

    this.difficulty = difficulty;
    this.size = cfg.size;
    this.maze = Maze.generate(cfg.size, cfg.size, rng);
    this.start = { x: 0, y: 0 };
    this.goal = { x: cfg.size - 1, y: cfg.size - 1 };
    this.player = { x: 0, y: 0 };
    this.trail = [{ x: 0, y: 0 }];
    this.moves = 0;
    this.startTime = null;
    this.endTime = null;
    this.hintsLeft = HINTS_PER_MAZE;
    this.hintsUsed = 0;
    this.hintCells = [];
    this.hintUntil = 0;
    this.solution = null;
    this.status = 'playing'; // 'playing' | 'won' | 'gaveup'
  }

  // Zwraca: 'moved', 'blocked' (ściana), 'won' albo 'ignored' (gra zakończona).
  Game.prototype.move = function (dir, t) {
    if (this.status !== 'playing') return 'ignored';
    t = t === undefined ? now() : t;

    var p = this.player;
    if (!Maze.canMove(this.maze, p.x, p.y, dir)) return 'blocked';

    var d = Maze.DIRS[dir];
    if (this.startTime === null) this.startTime = t;
    p.x += d.dx;
    p.y += d.dy;
    this.moves++;
    this.trail.push({ x: p.x, y: p.y });

    if (p.x === this.goal.x && p.y === this.goal.y) {
      this.status = 'won';
      this.endTime = t;
      this.hintCells = [];
      return 'won';
    }
    return 'moved';
  };

  Game.prototype.useHint = function (t) {
    if (this.status !== 'playing' || this.hintsLeft <= 0) return false;
    t = t === undefined ? now() : t;
    var path = Maze.solve(this.maze, this.player, this.goal);
    this.hintCells = path.slice(1, 1 + HINT_LENGTH);
    this.hintUntil = t + HINT_DURATION;
    this.hintsLeft--;
    this.hintsUsed++;
    return true;
  };

  Game.prototype.hintVisible = function (t) {
    t = t === undefined ? now() : t;
    return this.hintCells.length > 0 && t < this.hintUntil;
  };

  // Poddanie się: pokazujemy całą drogę od startu do mety, wynik nie jest zapisywany.
  Game.prototype.giveUp = function (t) {
    if (this.status !== 'playing') return false;
    t = t === undefined ? now() : t;
    this.solution = Maze.solve(this.maze, this.start, this.goal);
    this.status = 'gaveup';
    this.endTime = this.startTime === null ? null : t;
    this.hintCells = [];
    return true;
  };

  // Czas liczony od pierwszego ruchu.
  Game.prototype.elapsed = function (t) {
    if (this.startTime === null) return 0;
    var end = this.endTime !== null ? this.endTime : (t === undefined ? now() : t);
    return Math.max(0, end - this.startTime);
  };

  function formatTime(ms) {
    var tenths = Math.floor(ms / 100);
    var t = tenths % 10;
    var totalSec = Math.floor(tenths / 10);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + t;
  }

  Game.HINTS_PER_MAZE = HINTS_PER_MAZE;
  Game.HINT_LENGTH = HINT_LENGTH;
  Game.HINT_DURATION = HINT_DURATION;

  global.Game = Game;
  global.DIFFICULTIES = DIFFICULTIES;
  global.formatTime = formatTime;
})(window);
