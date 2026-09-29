// Generator labiryntu (DFS z cofaniem) i szukanie drogi (BFS).
// Labirynt to siatka pól; każde pole przechowuje maskę bitową ścian, które wciąż stoją.
(function (global) {
  'use strict';

  var N = 1, E = 2, S = 4, W = 8;

  var DIRS = {
    up:    { bit: N, dx: 0,  dy: -1, opposite: S },
    right: { bit: E, dx: 1,  dy: 0,  opposite: W },
    down:  { bit: S, dx: 0,  dy: 1,  opposite: N },
    left:  { bit: W, dx: -1, dy: 0,  opposite: E }
  };
  var DIR_NAMES = ['up', 'right', 'down', 'left'];

  function inBounds(maze, x, y) {
    return x >= 0 && y >= 0 && x < maze.width && y < maze.height;
  }

  function index(maze, x, y) {
    return y * maze.width + x;
  }

  // Wersja iteracyjna (z własnym stosem), żeby duże plansze nie przepełniły stosu wywołań.
  function generate(width, height, rng) {
    rng = rng || Math.random;
    var maze = { width: width, height: height, cells: new Uint8Array(width * height) };
    maze.cells.fill(N | E | S | W);

    var visited = new Uint8Array(width * height);
    var stack = [0];
    visited[0] = 1;

    while (stack.length) {
      var idx = stack[stack.length - 1];
      var x = idx % width;
      var y = (idx - x) / width;

      var options = [];
      for (var i = 0; i < DIR_NAMES.length; i++) {
        var d = DIRS[DIR_NAMES[i]];
        var nx = x + d.dx, ny = y + d.dy;
        if (inBounds(maze, nx, ny) && !visited[index(maze, nx, ny)]) options.push(d);
      }

      if (!options.length) {
        stack.pop();
        continue;
      }

      var pick = options[Math.floor(rng() * options.length)];
      var nIdx = index(maze, x + pick.dx, y + pick.dy);
      // Burzymy ścianę po obu stronach, żeby dane były spójne.
      maze.cells[idx] &= ~pick.bit;
      maze.cells[nIdx] &= ~pick.opposite;
      visited[nIdx] = 1;
      stack.push(nIdx);
    }

    return maze;
  }

  function hasWall(maze, x, y, dir) {
    return (maze.cells[index(maze, x, y)] & DIRS[dir].bit) !== 0;
  }

  function canMove(maze, x, y, dir) {
    var d = DIRS[dir];
    if (!d || !inBounds(maze, x, y)) return false;
    if (maze.cells[index(maze, x, y)] & d.bit) return false;
    return inBounds(maze, x + d.dx, y + d.dy);
  }

  function openNeighbors(maze, x, y) {
    var result = [];
    for (var i = 0; i < DIR_NAMES.length; i++) {
      var name = DIR_NAMES[i];
      if (canMove(maze, x, y, name)) {
        result.push({ x: x + DIRS[name].dx, y: y + DIRS[name].dy });
      }
    }
    return result;
  }

  // Zwraca listę pól od `from` do `to` włącznie albo null, gdy drogi nie ma.
  function solve(maze, from, to) {
    var total = maze.width * maze.height;
    var prev = new Int32Array(total).fill(-1);
    var start = index(maze, from.x, from.y);
    var goal = index(maze, to.x, to.y);
    var queue = [start];
    prev[start] = start;

    for (var head = 0; head < queue.length; head++) {
      var idx = queue[head];
      if (idx === goal) break;
      var x = idx % maze.width;
      var y = (idx - x) / maze.width;
      var next = openNeighbors(maze, x, y);
      for (var i = 0; i < next.length; i++) {
        var nIdx = index(maze, next[i].x, next[i].y);
        if (prev[nIdx] === -1) {
          prev[nIdx] = idx;
          queue.push(nIdx);
        }
      }
    }

    if (prev[goal] === -1) return null;

    var path = [];
    for (var cur = goal; ; cur = prev[cur]) {
      path.push({ x: cur % maze.width, y: Math.floor(cur / maze.width) });
      if (cur === start) break;
    }
    return path.reverse();
  }

  function reachableCount(maze, from) {
    var seen = new Uint8Array(maze.width * maze.height);
    var stack = [from];
    seen[index(maze, from.x, from.y)] = 1;
    var count = 0;
    while (stack.length) {
      var c = stack.pop();
      count++;
      var next = openNeighbors(maze, c.x, c.y);
      for (var i = 0; i < next.length; i++) {
        var nIdx = index(maze, next[i].x, next[i].y);
        if (!seen[nIdx]) {
          seen[nIdx] = 1;
          stack.push(next[i]);
        }
      }
    }
    return count;
  }

  // Liczy każde przejście raz (tylko w prawo i w dół).
  function countPassages(maze) {
    var count = 0;
    for (var y = 0; y < maze.height; y++) {
      for (var x = 0; x < maze.width; x++) {
        if (canMove(maze, x, y, 'right')) count++;
        if (canMove(maze, x, y, 'down')) count++;
      }
    }
    return count;
  }

  // Prosty generator liczb pseudolosowych z ziarnem – używany w testach.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.Maze = {
    DIRS: DIRS,
    DIR_NAMES: DIR_NAMES,
    generate: generate,
    inBounds: inBounds,
    hasWall: hasWall,
    canMove: canMove,
    openNeighbors: openNeighbors,
    solve: solve,
    reachableCount: reachableCount,
    countPassages: countPassages,
    mulberry32: mulberry32
  };
})(window);
