// Stan jednej rozgrywki: pozycja gracza, ślad, ruchy, czas, podpowiedzi. Bez DOM.
// Labirynt powstaje z ziarna (seed), a udane ruchy zapisujemy literami w `path`,
// więc z pary seed + path da się odtworzyć grę (wznawianie).
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

  var DIR_LETTERS = { up: 'U', down: 'D', left: 'L', right: 'R' };
  var LETTER_DIRS = { U: 'up', D: 'down', L: 'left', R: 'right' };

  function now() {
    return global.performance ? global.performance.now() : Date.now();
  }

  // Losowa liczba uint32 – ziarno nowego labiryntu.
  function randomSeed() {
    if (global.crypto && global.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      global.crypto.getRandomValues(a);
      return a[0];
    }
    return Math.floor(Math.random() * 4294967296);
  }

  function Game(difficulty, seed) {
    var cfg = DIFFICULTIES[difficulty];
    if (!cfg) throw new Error('Nieznany poziom trudności: ' + difficulty);

    this.difficulty = difficulty;
    this.size = cfg.size;
    this.seed = seed === undefined || seed === null ? randomSeed() : seed >>> 0;
    this.maze = Maze.generate(cfg.size, cfg.size, Maze.mulberry32(this.seed));
    this.start = { x: 0, y: 0 };
    this.goal = { x: cfg.size - 1, y: cfg.size - 1 };
    this.player = { x: 0, y: 0 };
    this.trail = [{ x: 0, y: 0 }];
    this.path = '';
    this.moves = 0;
    this.startTime = null;
    this.endTime = null;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
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
    this.path += DIR_LETTERS[dir];
    this.trail.push({ x: p.x, y: p.y });

    if (p.x === this.goal.x && p.y === this.goal.y) {
      this.status = 'won';
      this.endTime = t;
      this.finishedAt = new Date().toISOString();
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
    this.finishedAt = new Date().toISOString();
    this.hintCells = [];
    return true;
  };

  // Czas liczony od pierwszego ruchu.
  Game.prototype.elapsed = function (t) {
    if (this.startTime === null) return 0;
    var end = this.endTime !== null ? this.endTime : (t === undefined ? now() : t);
    return Math.max(0, end - this.startTime);
  };

  // Stan gry do zapisu w bazie lub w wynikach gościa (nazwy pól jak w tabeli games).
  Game.prototype.snapshot = function (t) {
    return {
      difficulty: this.difficulty,
      seed: this.seed,
      path: this.path,
      moves: this.moves,
      elapsed_ms: Math.round(this.elapsed(t)),
      hints_used: this.hintsUsed,
      status: this.status,
      started_at: this.startedAt,
      finished_at: this.finishedAt
    };
  };

  // Odtwarza grę w toku: ten sam labirynt z ziarna, ruchy ze ścieżki, czas i podpowiedzi.
  Game.restore = function (saved, t) {
    t = t === undefined ? now() : t;
    var game = new Game(saved.difficulty, saved.seed);
    for (var i = 0; i < saved.path.length; i++) {
      var dir = LETTER_DIRS[saved.path.charAt(i)];
      if (!dir || game.move(dir, t) !== 'moved') {
        throw new Error('Zapisana ścieżka nie pasuje do labiryntu (krok ' + (i + 1) + ')');
      }
    }
    var elapsed = saved.elapsed_ms || 0;
    game.startTime = game.moves > 0 || elapsed > 0 ? t - elapsed : null;
    game.hintsUsed = saved.hints_used || 0;
    game.hintsLeft = Math.max(0, HINTS_PER_MAZE - game.hintsUsed);
    if (saved.started_at) game.startedAt = saved.started_at;
    return game;
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
