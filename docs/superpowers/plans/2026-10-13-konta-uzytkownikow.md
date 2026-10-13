# Konta użytkowników, zapis wyników i wznawianie gry – plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** gra „Nić Ariadny” działa od razu jako gość, a po zalogowaniu (e-mail lub nazwa użytkownika i hasło) zapisuje historię wyników, rekordy i grę w toku w Supabase. Wyniki gościa można „uratować” logowaniem.

**Architektura:** statyczne pliki na GitHub Pages, bez bundlera. `supabase-js` jest wczytywany z CDN w ustalonej wersji. Cała rozmowa z Supabase odbywa się w `js/api.js` (obiekt `Api`), a wyniki gościa czekają w `js/guest.js` (`GuestResults`). Po stronie bazy jest tabela `games` (już wdrożona), nowe `profiles`, funkcje `username_available` i `import_guest_games`, widok `my_stats` oraz Edge Function `login` do logowania nazwą.

**Technologie:**
- JavaScript ES5 w IIFE, jak w istniejącym kodzie;
- Supabase (PostgreSQL, Auth, PostgREST, Edge Functions, Deno);
- `@supabase/supabase-js@2.49.4` (UMD z jsDelivr);
- testy: `tests.html` (własny mini-runner), PGlite `@electric-sql/pglite@0.2.17`, `playwright-core@1.48.2` z lokalnym Chrome.

**Projekt:** `docs/superpowers/specs/2026-10-13-konta-uzytkownikow-design.md`

## Global Constraints

- **Kod i styl:** bez kroku budowania i bez modułów ES w grze. Każdy plik `js/*.js` to IIFE `(function (global) { 'use strict'; … })(window);` z `var`, bez `let`, `const` i funkcji strzałkowych, jak obecny kod.
- **Język:** teksty w interfejsie i komentarze w kodzie po polsku. Komentarze krótkie, w stylu istniejących plików.
- **Projekt Supabase:**
  - ref `tiyvaauexqvlgpyewirt`;
  - adres `https://tiyvaauexqvlgpyewirt.supabase.co`;
  - klucz publiczny `sb_publishable_zYAZ5akuhrgRaigWM4FYGg_PvYMPI1b`.
- **Klucze:** nigdy żadnego klucza `secret`, `sb_secret_…` ani `service_role` w plikach repozytorium ani w przeglądarce. Edge Function bierze go ze zmiennej środowiskowej.
- **Adres gry (Site URL / redirect):** `https://justynaanalityk.github.io/Gra-maze/`
- **Nazwa użytkownika:** `^[A-Za-z0-9_]{3,20}$`, unikalna bez względu na wielkość liter.
- **Hasło:** minimum 8 znaków.
- **Wyniki gościa:**
  - klucz `nic.guest-results`;
  - najwyżej 20 pozycji;
  - import tylko statusów `won` / `gaveup`;
  - daty nie starsze niż 30 dni i nie późniejsze niż teraz + 5 min.
- **Autozapis:** najwyżej co 3000 ms, ponowienie po błędzie po 5000 ms.
- **Wersje:** `supabase-js` 2.49.4 (w przeglądarce i w Edge Function), `playwright-core` 1.48.2, `@electric-sql/pglite` 0.2.17.
- **Git:**
  - praca na gałęzi `baza-zapis-wynikow`;
  - commit po każdym zadaniu, zakończony linią `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`;
  - **bez `git push`** i bez zmian w Supabase poza Zadaniem 5 i 10, chyba że użytkowniczka zgodzi się wprost.
- **Panel Supabase:** zmiany w Supabase (SQL, ustawienia Auth, wdrożenie funkcji) robi narzędzie `tools/supabase-admin.mjs`:
  - otwiera Chrome i czeka, aż użytkowniczka **sama się zaloguje**;
  - korzysta z sesji panelu tylko do wskazanych operacji przez Management API (`api.supabase.com`);
  - po pracy kasuje profil przeglądarki.
  Tokenu nie zapisuje się nigdzie na dysku.

## Review Focus

1. **Pisanie w polach formularza** (litery `w a s d m h r`, strzałki) nie może ruszać gracza ani przełączać dźwięku. Test: Zadanie 7, krok 1.
2. **Wyjście do menu tuż po ruchu** (Esc w ciągu 3 s) musi zapisać ostatnie ruchy, a „Wznów” pokazuje tę samą liczbę ruchów. Test: Zadanie 10, scenariusz `esc-po-ruchu`.
3. **Logowanie, gdy są wyniki gościa, a w bazie trwa gra:** import nie może porzucić gry w toku. Test: Zadanie 3, `import nie porzuca gry w toku`.
4. **CDN Supabase nieosiągalny lub brak sieci:** gra startuje jako gość, menu pokazuje „Brak połączenia – wyniki zapiszą się później”, a wygrana trafia do kolejki. Test: Zadanie 10, scenariusz `offline`.
5. **Logowanie nazwą z inną wielkością liter i z `_`:** `JUSTYNA` loguje konto `justyna`, ale `uXabc` nie loguje konta `u_abc` (podkreślnik w `ilike` to symbol wieloznaczny). Test: Zadanie 5, `live-test.mjs`.

---

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `js/game.js` (zmiana) | `seed`, `path`, `snapshot()`, `Game.restore()` |
| `js/guest.js` (nowy) | `GuestResults`: kolejka wyników gościa w `localStorage` |
| `js/input.js` (zmiana) | ignorowanie klawiszy wpisywanych w pola formularzy |
| `js/storage.js` (zmiana) | tylko wyciszenie dźwięku gościa |
| `js/supabase-config.js` (nowy) | adres projektu, klucz publiczny, adres gry |
| `js/api.js` (nowy) | `Api`: konto, profil, gry, import, tłumaczenie błędów |
| `js/auth-ui.js` (nowy) | `AuthUI`: logowanie, rejestracja, reset i nowe hasło |
| `js/profile.js` (nowy) | `ProfileUI`: ekran „Mój profil” |
| `js/main.js` (przepisany) | ekrany, tryb gościa, autozapis, wznawianie, menu |
| `index.html`, `style.css` (zmiana) | nowe sekcje i style |
| `tests.html` (zmiana) | testy jednostkowe nowych części |
| `supabase/migrations/20261013150000_profiles.sql` (nowy) | profile, import, statystyki, zaostrzone RLS |
| `supabase/functions/login/index.ts` (nowy) | logowanie nazwą użytkownika |
| `tools/package.json`, `tools/*.mjs` (nowe) | narzędzia testowe i administracyjne (Node) |

---

### Zadanie 1: Gra z ziarnem, ścieżką ruchów i wznawianiem

**Pliki:**
- Zmiana: `js/game.js` (cały plik poniżej)
- Zmiana: `tests.html` (wywołania `new Game` i nowe testy)
- Nowe: `tools/package.json`, `tools/unit-test.mjs`, `tools/.gitignore`

**Interfejsy:**
- Wykorzystuje: `Maze.generate(w, h, rng)` i `Maze.mulberry32(seed)` z `js/maze.js` (bez zmian).
- Udostępnia:
  - `new Game(difficulty, seed?)`, gdzie `seed` to liczba uint32, a przy braku jest losowana;
  - pola `game.seed` (number), `game.path` (string `U/D/L/R`), `game.startedAt` i `game.finishedAt` (ISO string lub `null`);
  - `game.snapshot(t?)` zwraca `{ difficulty, seed, path, moves, elapsed_ms, hints_used, status, started_at, finished_at }`;
  - `Game.restore(saved, t?)` zwraca `Game`. `saved` ma pola `difficulty, seed, path, elapsed_ms, hints_used` i opcjonalnie `started_at`. Rzuca `Error`, gdy ścieżka nie pasuje albo dochodzi do mety.

- [ ] **Krok 1: Narzędzie do uruchamiania `tests.html` z wiersza poleceń**

`tools/package.json`:
```json
{
  "name": "nic-ariadny-tools",
  "private": true,
  "type": "module",
  "scripts": {
    "unit": "node unit-test.mjs",
    "sql": "node sql-test.mjs",
    "live": "node live-test.mjs",
    "e2e": "node e2e.mjs"
  },
  "dependencies": {
    "@electric-sql/pglite": "0.2.17",
    "playwright-core": "1.48.2"
  }
}
```

`tools/.gitignore`:
```
node_modules/
out/
```

`tools/unit-test.mjs`:
```js
// Otwiera tests.html w Chrome (bez okna) i wypisuje wynik. Kod wyjścia 1 = coś nie przeszło.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'tests.html')).href);
await page.waitForFunction(() => /^(OK|FAIL)/.test(document.title), null, { timeout: 30000 });
const summary = await page.textContent('#summary');
const failed = await page.$$eval('#results .fail', els => els.map(e => e.innerText));
console.log(summary);
failed.forEach(f => console.log('  ' + f.replace(/\n/g, '\n    ')));
errors.forEach(e => console.log('BŁĄD STRONY: ' + e));
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
```

Uruchom: `cd tools && npm install && node unit-test.mjs`
Oczekiwane: `Wszystkie testy przeszły (16)`

- [ ] **Krok 2: Testy używają liczbowego ziarna zamiast `Maze.mulberry32(...)`**

W `tests.html` zamień każde `new Game(X, Maze.mulberry32(N))` na `new Game(X, N)`:
```bash
sed -i -E "s/new Game\(([^,]+), Maze\.mulberry32\(([0-9]+)\)\)/new Game(\1, \2)/g" tests.html
grep -c "new Game([^,]*, [0-9]*)" tests.html
```
Oczekiwane: `7` (w tym `new Game(diff, 123)` w pętli po poziomach)

- [ ] **Krok 3: Nowe testy (przed sekcją `// ---- Uruchomienie ----` w `tests.html`)**

```js
      // ---- Zapis i wznawianie ----

      function mazeKey(maze) {
        var s = '';
        for (var i = 0; i < maze.cells.length; i++) s += maze.cells[i].toString(16);
        return s;
      }

      test('Ten sam seed daje ten sam labirynt, a gra bez seeda losuje go sama', function () {
        assertEqual(mazeKey(new Game('medium', 12345).maze), mazeKey(new Game('medium', 12345).maze), 'labirynt z tego samego seeda');
        var g = new Game('easy');
        assert(typeof g.seed === 'number' && g.seed >= 0 && g.seed <= 4294967295 && g.seed === Math.floor(g.seed), 'losowy seed uint32: ' + g.seed);
        assertEqual(mazeKey(g.maze), mazeKey(new Game('easy', g.seed).maze), 'labirynt odtworzony z losowego seeda');
      });

      test('Ścieżka zapisuje tylko udane ruchy literami U D L R', function () {
        var game = new Game('easy', 5);
        var dirs = directionsFor(Maze.solve(game.maze, game.start, game.goal)).slice(0, 4);
        game.move('up', 0);   // ściany obwodu – bez zapisu
        game.move('left', 0);
        dirs.forEach(function (d, i) { game.move(d, i); });
        var expected = dirs.map(function (d) { return { up: 'U', down: 'D', left: 'L', right: 'R' }[d]; }).join('');
        assertEqual(game.path, expected);
        assertEqual(game.moves, game.path.length);
      });

      test('Wznowienie odtwarza labirynt, pozycję, nić, ruchy, czas i podpowiedzi', function () {
        var game = new Game('medium', 777);
        var dirs = directionsFor(Maze.solve(game.maze, game.start, game.goal)).slice(0, 12);
        dirs.forEach(function (d, i) { game.move(d, 1000 + i * 100); });
        game.useHint(2500);
        var snap = game.snapshot(5000);
        assertEqual(snap.elapsed_ms, 4000, 'czas w zapisie');
        var restored = Game.restore(snap, 20000);
        assertEqual(mazeKey(restored.maze), mazeKey(game.maze), 'labirynt');
        assertEqual(restored.player.x + ',' + restored.player.y, game.player.x + ',' + game.player.y, 'pozycja');
        assertEqual(JSON.stringify(restored.trail), JSON.stringify(game.trail), 'nić');
        assertEqual(restored.moves, 12, 'ruchy');
        assertEqual(restored.path, game.path, 'ścieżka');
        assertEqual(restored.elapsed(20000), 4000, 'czas po wznowieniu');
        assertEqual(restored.elapsed(21500), 5500, 'zegar biegnie dalej');
        assertEqual(restored.hintsUsed, 1, 'użyte podpowiedzi');
        assertEqual(restored.hintsLeft, 2, 'pozostałe podpowiedzi');
        assertEqual(restored.status, 'playing');
      });

      test('Wznowienie gry bez ruchów: zegar startuje dopiero od pierwszego ruchu', function () {
        var restored = Game.restore({ difficulty: 'easy', seed: 9, path: '', elapsed_ms: 0, hints_used: 0 }, 5000);
        assertEqual(restored.startTime, null);
        assertEqual(restored.elapsed(9000), 0);
      });

      test('Nie da się wznowić gry, której ścieżka kończy się na mecie albo nie pasuje do labiryntu', function () {
        var game = new Game('easy', 31);
        directionsFor(Maze.solve(game.maze, game.start, game.goal)).forEach(function (d, i) { game.move(d, i); });
        assertEqual(game.status, 'won');
        [game.path, 'UUU', 'X'].forEach(function (path) {
          var threw = false;
          try { Game.restore({ difficulty: 'easy', seed: 31, path: path, elapsed_ms: 1, hints_used: 0 }, 0); } catch (e) { threw = true; }
          assert(threw, 'ścieżka „' + path.slice(0, 8) + '” nie powinna dać się wznowić');
        });
      });

      test('Zapis zakończonej gry ma status i datę końca', function () {
        var game = new Game('easy', 4);
        game.move(Maze.canMove(game.maze, 0, 0, 'right') ? 'right' : 'down', 100);
        game.giveUp(900);
        var snap = game.snapshot(900);
        assertEqual(snap.status, 'gaveup');
        assert(snap.finished_at && snap.started_at <= snap.finished_at, 'daty');
        assertEqual(snap.moves, 1);
        assertEqual(new Game('easy', 4).snapshot().finished_at, null, 'gra w toku nie ma daty końca');
      });
```

- [ ] **Krok 4: Uruchom testy i potwierdź, że nowe nie przechodzą**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `Nie przeszło: 6 z 22` (stare 16 przechodzą, bo ten sam seed daje ten sam labirynt).

- [ ] **Krok 5: Nowy `js/game.js`**

```js
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
```

- [ ] **Krok 6: Uruchom testy**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `Wszystkie testy przeszły (22)`

- [ ] **Krok 7: Sprawdź, że gra działa jak przedtem**

Otwórz `index.html`: menu, gra na poziomie Łatwy, kilka ruchów, podpowiedź, poddanie się. W konsoli przeglądarki nie może być błędów (`js/preview.js` woła `new Game('easy')` bez ziarna, co jest obsłużone).

- [ ] **Krok 8: Commit**

```bash
git add js/game.js tests.html tools/package.json tools/package-lock.json tools/.gitignore tools/unit-test.mjs
git commit -m "Gra: ziarno, ścieżka ruchów i odtwarzanie do wznawiania

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 2: Kolejka wyników gościa (`GuestResults`)

**Pliki:**
- Nowy: `js/guest.js`
- Zmiana: `tests.html` (dodaj `<script src="js/guest.js"></script>` po `js/game.js` i testy)

**Interfejsy:**
- Wykorzystuje: obiekty z `game.snapshot()` (Zadanie 1).
- Udostępnia `window.GuestResults` z metodami:
  - `add(snapshot)` zwraca element z dodanym polem `id` (string);
  - `list()` zwraca tablicę;
  - `count()` zwraca liczbę;
  - `best(difficulty)` zwraca `number | null` (najmniejsze `elapsed_ms` wśród `won`);
  - `remove(ids)` usuwa wskazane wyniki;
  - `GuestResults.create(getStorage)` tworzy instancję (do testów).

- [ ] **Krok 1: Testy (przed `// ---- Uruchomienie ----`)**

```js
      // ---- Wyniki gościa ----

      function memoryStorage() {
        var data = {};
        return {
          getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
          setItem: function (k, v) { data[k] = String(v); }
        };
      }
      function result(i, extra) {
        var r = { difficulty: 'easy', seed: i, path: 'R', moves: 1, elapsed_ms: 1000 + i, hints_used: 0, status: 'won',
                  started_at: '2026-10-13T10:00:00.000Z', finished_at: '2026-10-13T10:01:00.000Z' };
        for (var k in extra) r[k] = extra[k];
        return r;
      }

      test('Wyniki gościa: dodawanie, licznik i rekord tylko z wygranych', function () {
        var store = memoryStorage();
        var gr = GuestResults.create(function () { return store; });
        gr.add(result(1, { elapsed_ms: 9000 }));
        gr.add(result(2, { elapsed_ms: 4000, difficulty: 'medium' }));
        gr.add(result(3, { elapsed_ms: 2000, status: 'gaveup' }));
        gr.add(result(4, { elapsed_ms: 7000 }));
        assertEqual(gr.count(), 4);
        assertEqual(gr.best('easy'), 7000, 'rekord łatwego bez poddanej gry');
        assertEqual(gr.best('medium'), 4000);
        assertEqual(gr.best('hard'), null);
        var again = GuestResults.create(function () { return store; });
        assertEqual(again.count(), 4, 'wyniki przetrwały odświeżenie strony');
      });

      test('Wyniki gościa: najwyżej 20, najstarsze wypadają', function () {
        var store = memoryStorage();
        var gr = GuestResults.create(function () { return store; });
        for (var i = 1; i <= 23; i++) gr.add(result(i));
        var list = gr.list();
        assertEqual(list.length, 20);
        assertEqual(list[0].seed, 4, 'najstarszy zachowany');
        assertEqual(list[19].seed, 23, 'najnowszy');
      });

      test('Wyniki gościa: usuwanie po zapisie w bazie', function () {
        var store = memoryStorage();
        var gr = GuestResults.create(function () { return store; });
        gr.add(result(1)); gr.add(result(2)); gr.add(result(3));
        var ids = gr.list().map(function (r) { return r.id; });
        assert(ids[0] && ids[0] !== ids[1] && ids[1] !== ids[2], 'każdy wynik ma własne id');
        gr.remove([ids[0], ids[2]]);
        assertEqual(gr.count(), 1);
        assertEqual(gr.list()[0].seed, 2);
      });

      test('Wyniki gościa działają bez localStorage (tryb prywatny, blokada)', function () {
        var broken = { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } };
        var gr = GuestResults.create(function () { return broken; });
        gr.add(result(1, { elapsed_ms: 3000 }));
        assertEqual(gr.count(), 1, 'wynik trzymany w pamięci');
        assertEqual(gr.best('easy'), 3000);
        var none = GuestResults.create(function () { throw new Error('no storage'); });
        none.add(result(2));
        assertEqual(none.count(), 1);
      });

      test('Wyniki gościa: uszkodzone dane w localStorage nie psują gry', function () {
        var store = memoryStorage();
        store.setItem('nic.guest-results', '{to nie jest json');
        var gr = GuestResults.create(function () { return store; });
        assertEqual(gr.count(), 0);
        gr.add(result(1));
        assertEqual(gr.count(), 1);
      });
```

- [ ] **Krok 2: Uruchom testy i potwierdź błąd**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: 5 testów nie przechodzi z błędem `GuestResults is not defined`.

- [ ] **Krok 3: `js/guest.js`**

```js
// Wyniki gościa: zakończone gry czekają w przeglądarce, aż gracz się zaloguje
// i będzie można zapisać je w bazie (Api.importGuestGames).
(function (global) {
  'use strict';

  var KEY = 'nic.guest-results';
  var LIMIT = 20;

  function create(getStorage) {
    var memory = []; // kopia na wypadek, gdy localStorage jest niedostępny

    function storage() {
      try { return getStorage(); } catch (e) { return null; }
    }

    function load() {
      var s = storage();
      if (!s) return memory.slice();
      try {
        var raw = s.getItem(KEY);
        if (raw === null) return memory.slice();
        var list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return memory.slice();
      }
    }

    function store(list) {
      memory = list.slice();
      var s = storage();
      if (!s) return;
      try { s.setItem(KEY, JSON.stringify(list)); } catch (e) { /* zostaje kopia w pamięci */ }
    }

    return {
      add: function (result) {
        var list = load();
        var item = {};
        for (var k in result) item[k] = result[k];
        item.id = Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36) + '-' + list.length;
        list.push(item);
        if (list.length > LIMIT) list = list.slice(list.length - LIMIT);
        store(list);
        return item;
      },
      list: function () { return load(); },
      count: function () { return load().length; },
      // Najlepszy czas z wygranych gier na danym poziomie albo null.
      best: function (difficulty) {
        var best = null;
        load().forEach(function (r) {
          if (r.difficulty === difficulty && r.status === 'won' && (best === null || r.elapsed_ms < best)) best = r.elapsed_ms;
        });
        return best;
      },
      remove: function (ids) {
        store(load().filter(function (r) { return ids.indexOf(r.id) === -1; }));
      }
    };
  }

  global.GuestResults = create(function () { return global.localStorage; });
  global.GuestResults.create = create;
})(window);
```

- [ ] **Krok 4: Uruchom testy**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `Wszystkie testy przeszły (27)`

- [ ] **Krok 5: Commit**

```bash
git add js/guest.js tests.html
git commit -m "Wyniki gościa czekają w przeglądarce na zalogowanie

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 3: Migracja bazy (profile, import wyników gościa, statystyki) z testami SQL

**Pliki:**
- Nowy: `supabase/migrations/20261013150000_profiles.sql`
- Nowy: `tools/sql-test.mjs`
- Zmiana: `docs/superpowers/specs/2026-10-13-konta-uzytkownikow-design.md` (doprecyzowanie: duplikat to ta sama gra `seed` + `path` + `status`; daty: finished_at ≤ teraz + 5 min, przycinane do teraz)

**Interfejsy:**
- Wykorzystuje: tabelę `games`, wyzwalacze i widok `my_best` z `20261013120000_games.sql` (już w bazie).
- Udostępnia (PostgREST):
  - tabela `profiles(id, username, muted, created_at)`: `select` i `update(muted)` własnego wiersza;
  - RPC `username_available(name text) → boolean` (anon i authenticated);
  - RPC `import_guest_games(items jsonb) → integer` (authenticated). `items` to tablica obiektów w formacie `game.snapshot()`. Wynik to liczba dodanych gier. Błąd `42501`, gdy brak konta; `22023`, gdy złe dane;
  - widok `my_stats(played, won, gaveup, abandoned, total_ms)`, zawsze jeden wiersz;
  - profil tworzony z `raw_user_meta_data.username` przy rejestracji.

- [ ] **Krok 1: `tools/sql-test.mjs` (testy obu migracji na PGlite z atrapą Supabase)**

```js
// Testy migracji SQL na PostgreSQL w Node (PGlite) z atrapą schematu auth i ról Supabase.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const db = new PGlite();
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text,
    is_anonymous boolean not null default false,
    raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  ok('migracja ' + f, true);
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const N = '33333333-3333-3333-3333-333333333333'; // konto anonimowe

// Zapytanie jako gracz (uid) albo jako niezalogowany (uid = null → rola anon).
async function as(uid, sql, params = [], { anonymous = false } = {}) {
  const role = uid ? 'authenticated' : 'anon';
  const claims = uid ? JSON.stringify({ sub: uid, role, is_anonymous: anonymous }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function rejects(name, fn) {
  try { await fn(); ok(name + ' (oczekiwano błędu)', false); }
  catch (e) { ok(name + ' -> ' + e.message.split('\n')[0], true); }
}
const signUp = (id, meta, extra = {}) =>
  db.query(`insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, extra.email ?? id.slice(0, 4) + '@test.pl', extra.anonymous ?? false, JSON.stringify(meta)]);
const iso = minutes => new Date(Date.now() + minutes * 60000).toISOString();
const item = (extra = {}) => ({ difficulty: 'easy', seed: 42, path: 'RD', moves: 2, elapsed_ms: 5000, hints_used: 1,
  status: 'won', started_at: iso(-10), finished_at: iso(-9), ...extra });
const importAs = (uid, items, opts) => as(uid, `select public.import_guest_games($1::jsonb) as n`, [JSON.stringify(items)], opts);

// ---- Rejestracja i profil ----
await signUp(A, { username: 'Justyna' });
let r = await db.query(`select username, muted from public.profiles where id = $1`, [A]);
ok('profil tworzy się przy rejestracji', r.rows.length === 1 && r.rows[0].username === 'Justyna' && r.rows[0].muted === false);

await rejects('zajęta nazwa (inna wielkość liter) przerywa rejestrację', () => signUp(B, { username: 'justyna' }));
r = await db.query(`select 1 from auth.users where id = $1`, [B]);
ok('po nieudanej rejestracji nie zostaje konto bez profilu', r.rows.length === 0);
await rejects('za krótka nazwa', () => signUp(B, { username: 'ab' }));
await rejects('niedozwolone znaki w nazwie', () => signUp(B, { username: 'zła nazwa' }));
await rejects('brak nazwy', () => signUp(B, {}));
await signUp(B, { username: 'Bartek_2' });
await signUp(N, {}, { anonymous: true });
r = await db.query(`select 1 from public.profiles where id = $1`, [N]);
ok('konto anonimowe nie dostaje profilu', r.rows.length === 0);

// ---- username_available ----
const avail = async (uid, name) => (await as(uid, `select public.username_available($1) as v`, [name])).rows[0].v;
ok('username_available: zajęta (bez logowania)', (await avail(null, 'JUSTYNA')) === false);
ok('username_available: wolna', (await avail(null, 'nowy_gracz')) === true);
ok('username_available: zła nazwa = niedostępna', (await avail(null, 'a b')) === false);
ok('username_available: działa też po zalogowaniu', (await avail(A, 'bartek_2')) === false);

// ---- RLS profili ----
r = await as(A, `select id, username from public.profiles`);
ok('gracz widzi tylko swój profil', r.rows.length === 1 && r.rows[0].id === A);
r = await as(A, `update public.profiles set muted = true where id = $1 returning muted`, [A]);
ok('gracz zmienia swoje wyciszenie', r.rows[0]?.muted === true);
r = await as(A, `update public.profiles set muted = true where id = $1 returning id`, [B]);
ok('gracz nie zmienia cudzego profilu', r.rows.length === 0);
await rejects('gracz nie zmienia nazwy', () => as(A, `update public.profiles set username = 'Inna' where id = $1`, [A]));
await rejects('gracz nie tworzy profili', () => as(A, `insert into public.profiles (id, username) values ($1, 'x_y_z')`, [N]));
await rejects('gracz nie usuwa profilu', () => as(A, `delete from public.profiles where id = $1`, [A]));
await rejects('bez logowania brak dostępu do profili', () => as(null, `select * from public.profiles`));

// ---- games: tylko prawdziwe konta ----
await rejects('konto anonimowe nie zaczyna gry', () =>
  as(N, `insert into public.games (difficulty, seed) values ('easy', 1)`, [], { anonymous: true }));
r = await as(A, `insert into public.games (difficulty, seed) values ('medium', 7) returning id, status`);
const playingId = r.rows[0].id;
ok('konto zaczyna grę', r.rows[0].status === 'playing');
await rejects('nadal: ruchy niezgodne ze ścieżką', () => as(A, `update public.games set path = 'RR', moves = 1 where id = $1`, [playingId]));

// ---- import_guest_games ----
r = await importAs(A, [item(), item({ seed: 43, status: 'gaveup', path: 'R', moves: 1 })]);
ok('import zapisuje 2 gry', r.rows[0].n === 2, 'n=' + r.rows[0].n);
r = await as(A, `select status from public.games where id = $1`, [playingId]);
ok('import nie porzuca gry w toku', r.rows[0].status === 'playing');
r = await as(A, `select status, started_at, finished_at from public.games where seed = 42`);
ok('import zachowuje status i daty gościa', r.rows[0].status === 'won' && Math.abs(new Date(r.rows[0].finished_at) - Date.now() - (-9 * 60000)) < 5000);
r = await importAs(A, [item()]);
ok('duplikat jest pomijany', r.rows[0].n === 0);
await rejects('import: status playing', () => importAs(A, [item({ seed: 50, status: 'playing' })]));
await rejects('import: data z przyszłości', () => importAs(A, [item({ seed: 51, finished_at: iso(60) })]));
await rejects('import: wynik starszy niż 30 dni', () => importAs(A, [item({ seed: 52, started_at: iso(-60 * 24 * 31 - 1), finished_at: iso(-60 * 24 * 31) })]));
await rejects('import: początek po końcu', () => importAs(A, [item({ seed: 53, started_at: iso(-1), finished_at: iso(-2) })]));
await rejects('import: ruchy niezgodne ze ścieżką', () => importAs(A, [item({ seed: 54, moves: 5 })]));
await rejects('import: ponad 20 wyników', () => importAs(A, Array.from({ length: 21 }, (_, i) => item({ seed: 100 + i }))));
await rejects('import: bez logowania', () => importAs(null, [item({ seed: 55 })]));
await rejects('import: konto anonimowe', () => importAs(N, [item({ seed: 56 })], { anonymous: true }));
r = await importAs(A, [item({ seed: 57, finished_at: iso(2), started_at: iso(-1) })]);
ok('import: lekko przyspieszony zegar (+2 min) jest przycinany', r.rows[0].n === 1);
r = await as(A, `select finished_at from public.games where seed = 57`);
ok('przycięta data końca nie jest z przyszłości', new Date(r.rows[0].finished_at) <= new Date(Date.now() + 1000));
r = await as(B, `select count(*)::int as c from public.games`);
ok('B nie widzi gier A', r.rows[0].c === 0);
r = await as(A, `insert into public.games (difficulty, seed) values ('easy', 8) returning id`);
r = await as(A, `select status from public.games where id = $1`, [playingId]);
ok('po imporcie zwykła nowa gra nadal porzuca poprzednią', r.rows[0].status === 'abandoned');

// ---- my_stats ----
r = await as(A, `select * from public.my_stats`);
const s = r.rows[0];
ok('my_stats: rozegrane, wygrane, poddane, porzucone', Number(s.played) === 4 && Number(s.won) === 2 && Number(s.gaveup) === 1 && Number(s.abandoned) === 1,
  JSON.stringify(s));
ok('my_stats: łączny czas', Number(s.total_ms) === 15000, String(s.total_ms));
r = await as(B, `select * from public.my_stats`);
ok('my_stats: nowy gracz ma zera', r.rows.length === 1 && Number(r.rows[0].played) === 0);
await rejects('my_stats bez logowania', () => as(null, `select * from public.my_stats`));

// ---- Usunięcie konta ----
await db.query(`delete from auth.users where id = $1`, [A]);
r = await db.query(`select (select count(*) from public.profiles where id = $1)::int as p, (select count(*) from public.games where player_id = $1)::int as g`, [A]);
ok('usunięcie konta usuwa profil i gry', r.rows[0].p === 0 && r.rows[0].g === 0);

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
process.exit(fails ? 1 : 0);
```

> Do `total_ms` A wchodzą gry: zaimportowane seed 42 (5000), 43 (5000) i 57 (5000), porzucona z seedem 7 (0 ms) oraz trwająca z seedem 8 (0 ms). Razem 15000. Rozegrane (bez `playing`): 42, 43, 57 i porzucona 7, czyli 4. Wygrane: 42 i 57, czyli 2.

- [ ] **Krok 2: Uruchom i potwierdź błąd**

Uruchom: `cd tools && node sql-test.mjs`
Oczekiwane: pierwsza migracja `OK`, potem `FAIL profil tworzy się przy rejestracji` (brak tabeli `profiles`).

- [ ] **Krok 3: `supabase/migrations/20261013150000_profiles.sql`**

```sql
-- Nić Ariadny: konta graczy. Profil z nazwą użytkownika, zapis wyników gościa po zalogowaniu,
-- statystyki. Do gier mają dostęp tylko prawdziwe konta (bez anonimowych).

-- ---- Profil ----

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  muted      boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil gracza: nazwa użytkownika (do logowania i wyświetlania) i ustawienia.';

-- Nazwa unikalna bez względu na wielkość liter.
create unique index profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (muted) on public.profiles to authenticated;

create policy "Gracz widzi swój profil"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Gracz zmienia swój profil"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profil powstaje razem z kontem. Zła lub zajęta nazwa przerywa rejestrację,
-- więc nie zostaje konto bez profilu.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Czy nazwa jest wolna – do podpowiedzi w formularzu rejestracji. Zwraca tylko tak/nie.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

revoke execute on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---- Gry: tylko prawdziwe konta ----

drop policy "Gracz widzi swoje gry" on public.games;
drop policy "Gracz zaczyna swoje gry" on public.games;
drop policy "Gracz zapisuje swoje gry" on public.games;

create policy "Gracz widzi swoje gry"
  on public.games for select to authenticated
  using ((select auth.uid()) = player_id
         and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Gracz zaczyna swoje gry"
  on public.games for insert to authenticated
  with check ((select auth.uid()) = player_id
              and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Gracz zapisuje swoje gry"
  on public.games for update to authenticated
  using ((select auth.uid()) = player_id
         and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))
  with check ((select auth.uid()) = player_id
              and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

-- Wyzwalacz nowej gry: wyjątek dla importu wyników gościa (flaga ustawiana tylko
-- w import_guest_games) – wtedy gra wchodzi jako zakończona i nie porzuca gry w toku.
create or replace function public.games_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.importing_guest_games', true) = 'on' then
    return new;
  end if;
  new.status      := 'playing';
  new.finished_at := null;
  new.started_at  := now();
  new.updated_at  := now();
  update public.games
     set status = 'abandoned'
   where player_id = new.player_id
     and status = 'playing';
  return new;
end;
$$;

-- ---- Import wyników gościa ----

create function public.import_guest_games(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  item     jsonb;
  started  timestamptz;
  finished timestamptz;
  added    integer := 0;
  n        integer;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Zapis wyników wymaga zalogowania' using errcode = '42501';
  end if;
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'Oczekiwano listy wyników' using errcode = '22023';
  end if;
  if jsonb_array_length(items) > 20 then
    raise exception 'Najwyżej 20 wyników naraz' using errcode = '22023';
  end if;

  perform set_config('app.importing_guest_games', 'on', true);
  for item in select value from jsonb_array_elements(items) loop
    if coalesce(item ->> 'status', '') not in ('won', 'gaveup') then
      raise exception 'Można zapisać tylko zakończone gry' using errcode = '22023';
    end if;
    started  := (item ->> 'started_at')::timestamptz;
    finished := (item ->> 'finished_at')::timestamptz;
    if started is null or finished is null or started > finished
       or finished > now() + interval '5 minutes'
       or finished < now() - interval '30 days' then
      raise exception 'Nieprawidłowe daty gry' using errcode = '22023';
    end if;
    -- Zegar przeglądarki może się lekko spieszyć – daty nie mogą być z przyszłości.
    finished := least(finished, now());
    started  := least(started, finished);

    insert into public.games
      (player_id, difficulty, seed, path, moves, elapsed_ms, hints_used, status, started_at, updated_at, finished_at)
    select uid, item ->> 'difficulty', (item ->> 'seed')::bigint, item ->> 'path', (item ->> 'moves')::integer,
           (item ->> 'elapsed_ms')::integer, (item ->> 'hints_used')::smallint, item ->> 'status',
           started, finished, finished
     where not exists (
       select 1 from public.games g
        where g.player_id = uid
          and g.seed = (item ->> 'seed')::bigint
          and g.path = item ->> 'path'
          and g.status = item ->> 'status');
    get diagnostics n = row_count;
    added := added + n;
  end loop;
  perform set_config('app.importing_guest_games', 'off', true);
  return added;
end;
$$;

revoke execute on function public.import_guest_games(jsonb) from public, anon, authenticated;
grant execute on function public.import_guest_games(jsonb) to authenticated;

-- ---- Statystyki gracza (zawsze jeden wiersz) ----

create view public.my_stats
with (security_invoker = true) as
select count(*) filter (where status <> 'playing')   as played,
       count(*) filter (where status = 'won')         as won,
       count(*) filter (where status = 'gaveup')      as gaveup,
       count(*) filter (where status = 'abandoned')   as abandoned,
       coalesce(sum(elapsed_ms), 0)                   as total_ms
  from public.games;

revoke all on public.my_stats from anon, authenticated;
grant select on public.my_stats to authenticated;
```

- [ ] **Krok 4: Uruchom testy SQL**

Uruchom: `cd tools && node sql-test.mjs`
Oczekiwane: wszystkie linie `OK` i na końcu `Wszystko OK`.

- [ ] **Krok 5: Doprecyzuj projekt**

W `docs/superpowers/specs/2026-10-13-konta-uzytkownikow-design.md`, w sekcji `import_guest_games`:
- zamień „ta sama gra (`seed` + `path` + `finished_at`)” na „ta sama gra (`seed` + `path` + `status`)”;
- zamień „`started_at ≤ finished_at ≤ now()`” na „`started_at ≤ finished_at ≤ now() + 5 min` (daty przycinane do teraz)”.

- [ ] **Krok 6: Commit**

```bash
git add supabase/migrations/20261013150000_profiles.sql tools/sql-test.mjs docs/superpowers/specs/2026-10-13-konta-uzytkownikow-design.md
git commit -m "Baza: profile graczy, import wyników gościa, statystyki

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 4: Edge Function `login` (logowanie nazwą użytkownika)

**Pliki:**
- Nowy: `supabase/functions/login/index.ts`

**Interfejsy:**
- Wykorzystuje: tabelę `profiles` (Zadanie 3) oraz zmienne środowiskowe funkcji `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` i `SUPABASE_ANON_KEY` (Supabase ustawia je sam).
- Udostępnia: `POST {SUPABASE_URL}/functions/v1/login`, body `{ username, password }`. Odpowiedzi:
  - `200 { access_token, refresh_token }`;
  - `401 { error: "invalid_credentials" }`;
  - `429 { error: "too_many_requests" }`;
  - `400 { error: "bad_request" }`.

- [ ] **Krok 1: `supabase/functions/login/index.ts`**

```ts
// Logowanie nazwą użytkownika: nazwa → e-mail (po stronie serwera) → sesja.
// Adres e-mail nigdy nie trafia do przeglądarki. Dla nieznanej nazwy i złego hasła
// odpowiedź jest taka sama, żeby nie dało się sprawdzić, czy konto istnieje.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const invalid = () => json(401, { error: 'invalid_credentials' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '').trim();
    password = String(body?.password ?? '');
  } catch {
    return json(400, { error: 'bad_request' });
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || !password) return invalid();

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, NO_SESSION);

  // ilike bez rozróżniania wielkości liter; „_” to w ilike symbol wieloznaczny – escapujemy.
  const pattern = username.replace(/_/g, '\\_');
  const { data: profile, error: pe } = await admin.from('profiles').select('id').ilike('username', pattern).maybeSingle();
  if (pe || !profile) return invalid();

  const { data: found, error: ue } = await admin.auth.admin.getUserById(profile.id);
  const email = found?.user?.email;
  if (ue || !email) return invalid();

  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';
  const auth = createClient(url, publicKey, NO_SESSION);
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error?.status === 429) return json(429, { error: 'too_many_requests' });
    return invalid();
  }
  return json(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
```

- [ ] **Krok 2: Sprawdź składnię**

Jeśli jest Deno, uruchom `deno check supabase/functions/login/index.ts`. Jeśli nie ma, uruchom `node --check` na wersji bez typów:
```bash
sed -E 's/: (number|unknown)//g; s/!\)/)/g; s/(Deno\.env\.get\([^)]*\))!/\1/g' supabase/functions/login/index.ts \
  | sed '1,/^import/{/^import/d}' > "$TMPDIR/login-check.mjs" && node --check "$TMPDIR/login-check.mjs" && echo składnia-ok
```
Oczekiwane: `składnia-ok`. Zachowanie funkcji sprawdza `tools/live-test.mjs` w Zadaniu 5.

- [ ] **Krok 3: Commit**

```bash
git add supabase/functions/login/index.ts
git commit -m "Edge Function: logowanie nazwą użytkownika bez ujawniania e-maili

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 5: Wdrożenie w Supabase i test na żywo

> **To zadanie zmienia projekt Supabase.** Przed uruchomieniem kroku 3 potwierdź z użytkowniczką, że może się zalogować w oknie, które się otworzy.

**Pliki:**
- Nowe: `tools/supabase-admin.mjs`, `tools/live-test.mjs`
- Zmiana: `supabase/README.md` (nowe kroki konfiguracji)

**Interfejsy:**
- Wykorzystuje: `supabase/migrations/20261013150000_profiles.sql` (Zadanie 3) i `supabase/functions/login/index.ts` (Zadanie 4).
- Udostępnia polecenie `node tools/supabase-admin.mjs <polecenia…>`, gdzie polecenia (wykonywane po kolei w jednej sesji) to:
  - `sql <plik>`;
  - `query "<SQL>"`;
  - `auth-config`;
  - `deploy-login`;
  - `logout` (kasuje profil przeglądarki).

- [ ] **Krok 1: `tools/supabase-admin.mjs`**

```js
// Zmiany w projekcie Supabase przez Management API, z sesji panelu, w której
// użytkowniczka SAMA się loguje w otwartym oknie Chrome. Token jest tylko w pamięci.
// Użycie: node supabase-admin.mjs sql ../supabase/migrations/X.sql auth-config deploy-login query "select 1" logout
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = 'tiyvaauexqvlgpyewirt';
const SITE = 'https://justynaanalityk.github.io/Gra-maze/';
const API = 'https://api.supabase.com/v1/projects/' + REF;
const here = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(os.tmpdir(), 'nic-ariadny-supabase-admin');
const log = m => console.log(new Date().toLocaleTimeString('pl-PL') + ' ' + m);

const args = process.argv.slice(2);
if (!args.length) { console.log('Polecenia: sql <plik> | query "<SQL>" | auth-config | deploy-login | logout'); process.exit(1); }

async function getToken() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: false, viewport: null });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://supabase.com/dashboard/project/' + REF, { waitUntil: 'commit', timeout: 0 }).catch(() => {});
  await page.bringToFront();
  log('Zaloguj się w otwartym oknie Chrome (czekam do 15 min)…');
  const deadline = Date.now() + 15 * 60000;
  let token = null;
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    token = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        try {
          const v = JSON.parse(localStorage.getItem(localStorage.key(i)));
          const t = v && (v.access_token || (v.currentSession && v.currentSession.access_token));
          if (typeof t === 'string' && t.split('.').length === 3) return t;
        } catch (e) { /* nie JSON */ }
      }
      return null;
    }).catch(() => null);
  }
  await ctx.close(); // zapis sesji na dysk przed wyjściem
  if (!token) throw new Error('Nie doczekałam się zalogowania.');
  log('Zalogowano – wykonuję polecenia.');
  return token;
}

async function api(token, method, url, body, isForm) {
  const headers = { Authorization: 'Bearer ' + token };
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(method + ' ' + url.replace(API, '') + ' → HTTP ' + res.status + ': ' + text.slice(0, 500));
  try { return JSON.parse(text); } catch { return text; }
}

const needsToken = args.some(a => ['sql', 'query', 'auth-config', 'deploy-login'].includes(a));
const token = needsToken ? await getToken() : null;
let code = 0;
for (let i = 0; i < args.length; i++) {
  const cmd = args[i];
  try {
    if (cmd === 'sql') {
      const file = path.resolve(args[++i]);
      await api(token, 'POST', API + '/database/query', { query: fs.readFileSync(file, 'utf8') });
      log('OK sql ' + path.basename(file));
    } else if (cmd === 'query') {
      const out = await api(token, 'POST', API + '/database/query', { query: args[++i] });
      log('OK query → ' + JSON.stringify(out).slice(0, 1000));
    } else if (cmd === 'auth-config') {
      await api(token, 'PATCH', API + '/config/auth', {
        external_anonymous_users_enabled: false,
        mailer_autoconfirm: true,          // bez potwierdzania maila przy rejestracji
        password_min_length: 8,
        site_url: SITE,
        uri_allow_list: SITE + ',' + SITE + '**'
      });
      log('OK auth-config');
    } else if (cmd === 'deploy-login') {
      const src = fs.readFileSync(path.join(here, '..', 'supabase', 'functions', 'login', 'index.ts'), 'utf8');
      const form = new FormData();
      form.append('metadata', JSON.stringify({ entrypoint_path: 'index.ts', name: 'login', verify_jwt: false }));
      form.append('file', new Blob([src], { type: 'application/typescript' }), 'index.ts');
      await api(token, 'POST', API + '/functions/deploy?slug=login', form, true);
      log('OK deploy-login');
    } else if (cmd === 'logout') {
      fs.rmSync(PROFILE, { recursive: true, force: true });
      log('OK logout – profil przeglądarki usunięty');
    } else {
      throw new Error('Nieznane polecenie: ' + cmd);
    }
  } catch (e) {
    code = 1;
    log('BŁĄD ' + cmd + ': ' + e.message);
  }
}
process.exit(code);
```

- [ ] **Krok 2: `tools/live-test.mjs` (test działającego projektu przez publiczne API)**

```js
// Test na żywo: rejestracja, profil, logowanie e-mailem i nazwą (Edge Function), import wyników gościa.
// Tworzy konta e2e.*@example.com – usuń je potem: supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@example.com'"
const URL_ = 'https://tiyvaauexqvlgpyewirt.supabase.co';
const KEY = 'sb_publishable_zYAZ5akuhrgRaigWM4FYGg_PvYMPI1b';
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };
const short = j => JSON.stringify(j).slice(0, 200);

async function call(method, p, { token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(URL_ + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const rnd = Math.random().toString(36).slice(2, 8);
const user = { username: 'u_' + rnd, email: 'e2e.' + rnd + '@example.com', password: 'Haslo-' + rnd + '!' };

let r = await call('POST', '/rest/v1/rpc/username_available', { body: { name: user.username } });
ok('nazwa wolna przed rejestracją', r.status === 200 && r.json === true, short(r.json));

r = await call('POST', '/auth/v1/signup', { body: {} });
ok('anonimowe logowanie wyłączone', r.status >= 400, 'HTTP ' + r.status);

r = await call('POST', '/auth/v1/signup', { body: { email: user.email, password: 'krotkie', data: { username: user.username } } });
ok('za krótkie hasło odrzucone', r.status >= 400, short(r.json));

r = await call('POST', '/auth/v1/signup', { body: { email: user.email, password: user.password, data: { username: user.username } } });
const token = r.json && r.json.access_token;
const uid = r.json && r.json.user && r.json.user.id;
ok('rejestracja bez potwierdzania maila daje sesję', r.status === 200 && !!token, 'HTTP ' + r.status + ' ' + short(r.json));
if (!token) process.exit(1);

r = await call('GET', '/rest/v1/profiles?select=username,muted', { token });
ok('profil utworzony', r.status === 200 && r.json[0]?.username === user.username, short(r.json));

r = await call('POST', '/rest/v1/rpc/username_available', { body: { name: user.username.toUpperCase() } });
ok('nazwa zajęta po rejestracji (inna wielkość liter)', r.json === false);

r = await call('POST', '/auth/v1/signup', { body: { email: 'e2e.x' + rnd + '@example.com', password: user.password, data: { username: user.username.toUpperCase() } } });
ok('druga rejestracja z tą samą nazwą odrzucona', r.status >= 400, short(r.json));

r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: user.email, password: user.password } });
ok('logowanie e-mailem', r.status === 200 && !!r.json.access_token);

r = await call('POST', '/functions/v1/login', { body: { username: user.username.toUpperCase(), password: user.password } });
ok('logowanie nazwą (inna wielkość liter)', r.status === 200 && !!r.json.access_token, 'HTTP ' + r.status + ' ' + short(r.json));
ok('odpowiedź logowania nie zawiera e-maila', !JSON.stringify(r.json).includes(user.email));

r = await call('POST', '/functions/v1/login', { body: { username: user.username, password: 'zle-haslo-123' } });
ok('złe hasło → 401 invalid_credentials', r.status === 401 && r.json.error === 'invalid_credentials', short(r.json));

r = await call('POST', '/functions/v1/login', { body: { username: user.username.replace('_', 'X'), password: user.password } });
ok('„_” nie działa jak symbol wieloznaczny', r.status === 401, 'HTTP ' + r.status);

r = await call('POST', '/functions/v1/login', { body: { username: 'nie_ma_' + rnd, password: user.password } });
ok('nieznana nazwa → ta sama odpowiedź 401', r.status === 401 && r.json.error === 'invalid_credentials');

r = await call('POST', '/rest/v1/games', { token, body: { difficulty: 'medium', seed: 5 } });
ok('gra w toku', r.status === 201, 'HTTP ' + r.status);

const iso = m => new Date(Date.now() + m * 60000).toISOString();
const item = { difficulty: 'easy', seed: 4242, path: 'RD', moves: 2, elapsed_ms: 4000, hints_used: 0, status: 'won', started_at: iso(-5), finished_at: iso(-4) };
r = await call('POST', '/rest/v1/rpc/import_guest_games', { token, body: { items: [item] } });
ok('import wyniku gościa', r.status === 200 && r.json === 1, short(r.json));
r = await call('POST', '/rest/v1/rpc/import_guest_games', { token, body: { items: [item] } });
ok('ponowny import pomija duplikat', r.json === 0);
r = await call('POST', '/rest/v1/rpc/import_guest_games', { body: { items: [item] } });
ok('import bez logowania odrzucony', r.status >= 400, 'HTTP ' + r.status);

r = await call('GET', '/rest/v1/games?status=eq.playing&select=id', { token });
ok('import nie porzucił gry w toku', r.json.length === 1);
r = await call('GET', '/rest/v1/my_stats?select=*', { token });
ok('my_stats', r.status === 200 && Number(r.json[0].won) === 1, short(r.json));
r = await call('GET', '/rest/v1/my_best?select=*', { token });
ok('my_best', r.json[0]?.best_ms === 4000, short(r.json));

r = await call('PATCH', '/rest/v1/profiles?id=eq.' + uid, { token, body: { muted: true } });
ok('zmiana wyciszenia', r.status === 200 || r.status === 204, 'HTTP ' + r.status);
r = await call('PATCH', '/rest/v1/profiles?id=eq.' + uid, { token, body: { username: 'inna_nazwa' } });
ok('nazwy nie da się zmienić', r.status >= 400, 'HTTP ' + r.status);

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
console.log('Konto testowe: ' + user.email);
process.exit(fails ? 1 : 0);
```

- [ ] **Krok 3: Wdrożenie (wymaga zalogowania użytkowniczki w otwartym oknie)**

Uruchom (z katalogu repozytorium):
```bash
node tools/supabase-admin.mjs \
  sql supabase/migrations/20261013150000_profiles.sql \
  auth-config \
  deploy-login \
  query "delete from auth.users where is_anonymous" \
  query "select count(*) from public.profiles"
```
Oczekiwane: `OK sql …`, `OK auth-config`, `OK deploy-login`, `OK query → []`, `OK query → [{"count":0}]`.

**Jeśli którekolwiek polecenie zwróci HTTP 401/403** (Management API nie przyjęło sesji panelu), wykonaj kroki ręcznie według sekcji 5 w `supabase/README.md` (krok 6 tego zadania), a SQL wklej w SQL Editor.

**Jeśli `deploy-login` zwróci inny błąd HTTP**, wdróż funkcję ręcznie w panelu:
1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nazwa: `login`.
3. Wklej treść `supabase/functions/login/index.ts`.
4. W ustawieniach funkcji wyłącz **Verify JWT** (`Enforce JWT verification`).
5. Kliknij **Deploy**.

- [ ] **Krok 4: Test na żywo**

Uruchom: `cd tools && node live-test.mjs`
Oczekiwane: wszystkie `OK` i `Wszystko OK`.

- [ ] **Krok 5: Usuń konta testowe i sesję panelu**

```bash
node tools/supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@example.com'" logout
```
Oczekiwane: `OK query → []` i `OK logout – profil przeglądarki usunięty`.

- [ ] **Krok 6: Instrukcja w `supabase/README.md`**

Dopisz na końcu pliku:
```markdown
## 5. Konta graczy (migracja 2)

Wszystko poniżej robi narzędzie `tools/supabase-admin.mjs` (zob. `docs/superpowers/plans/2026-10-13-konta-uzytkownikow.md`, Zadanie 5).
Ręcznie w panelu:

1. **SQL Editor:** uruchom `migrations/20261013150000_profiles.sql`.
2. **Authentication → Sign In / Providers:**
   - wyłącz **Allow anonymous sign-ins**;
   - wyłącz **Confirm email**;
   - minimalna długość hasła: 8.
3. **Authentication → URL Configuration:**
   - Site URL: `https://justynaanalityk.github.io/Gra-maze/`;
   - Redirect URLs: ten sam adres.
4. **Edge Functions:** wdróż `functions/login/index.ts` jako funkcję `login` z wyłączonym **Verify JWT**.
```

- [ ] **Krok 7: Commit**

```bash
git add tools/supabase-admin.mjs tools/live-test.mjs supabase/README.md
git commit -m "Narzędzia: wdrożenie w Supabase i test kont na żywo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 6: `Api` – jedyne miejsce rozmowy z Supabase

**Pliki:**
- Nowe: `js/supabase-config.js`, `js/api.js`
- Nowy: `tools/api-test.mjs` (test `Api` w prawdziwej przeglądarce na żywym projekcie)

**Interfejsy:**
- Wykorzystuje: globalny `supabase` z CDN (`supabase.createClient`), `window.SUPABASE_CONFIG`, RPC i tabele z Zadania 3 oraz funkcję `login` z Zadania 4.
- Udostępnia `window.Api`. Wszystkie metody asynchroniczne zwracają `Promise`. Błąd to `Error` z `message` po polsku i `kind`: `'network'`, `'auth'` albo `'data'`.
  - **Stan i zdarzenia:**
    - `available() → boolean`;
    - `init() → Promise<User|null>`;
    - `user() → User|null`, gdzie `User = { id, email, username, muted, created_at }`;
    - `onChange(fn(User|null))`;
    - `onRecovery(fn())`.
  - **Konto:**
    - `usernameAvailable(name) → Promise<boolean>`;
    - `signUp({ username, email, password }) → Promise<User>`;
    - `signIn(identifier, password) → Promise<User>`;
    - `signOut() → Promise`;
    - `resetPassword(email) → Promise`;
    - `updatePassword(password) → Promise`;
    - `setMuted(bool) → Promise`.
  - **Gry:**
    - `startGame(snapshot) → Promise<id>`;
    - `saveGame(id, snapshot) → Promise`;
    - `saveGameBeacon(id, snapshot)` (bez wyniku);
    - `finishGame(id, snapshot) → Promise`;
    - `getPlayingGame() → Promise<{ id, difficulty, seed, path, moves, elapsed_ms, hints_used, started_at }|null>`.
  - **Wyniki:**
    - `getBest() → Promise<{ [difficulty]: { best_ms, best_moves, wins } }>`;
    - `getStats() → Promise<{ played, won, gaveup, abandoned, total_ms }>`;
    - `getHistory(limit) → Promise<Array<{ difficulty, status, elapsed_ms, moves, hints_used, started_at, finished_at }>>`;
    - `importGuestGames(items) → Promise<{ saved: number, done: string[] }>`, gdzie `done` to `id` wyników zapisanych albo trwale odrzuconych.

- [ ] **Krok 1: Test `tools/api-test.mjs`**

```js
// Test obiektu Api w Chrome na żywym projekcie: rejestracja, gra, zapis, wznowienie, import, wylogowanie.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = `<!doctype html><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"></script>
<script src="${pathToFileURL(path.join(root, 'js/supabase-config.js')).href}"></script>
<script src="${pathToFileURL(path.join(root, 'js/api.js')).href}"></script>`;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(root, 'index.html')).href); // origin file:// jak w grze
await page.setContent(html);
const rnd = Math.random().toString(36).slice(2, 8);
const out = await page.evaluate(async (rnd) => {
  const log = [];
  const ok = (n, c, x) => log.push((c ? 'OK   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''));
  const err = async (p) => { try { await p; return null; } catch (e) { return e; } };
  ok('Api dostępne', Api.available());
  ok('init bez sesji', (await Api.init()) === null);
  const u = { username: 'a_' + rnd, email: 'e2e.api' + rnd + '@example.com', password: 'Haslo-' + rnd + '!' };
  ok('nazwa wolna', await Api.usernameAvailable(u.username));
  let e = await err(Api.signUp({ ...u, password: 'krotkie' }));
  ok('krótkie hasło – polski komunikat', e && /8 znaków/.test(e.message), e && e.message);
  const user = await Api.signUp(u);
  ok('rejestracja', user && user.username === u.username && Api.user() === user);
  const id = await Api.startGame({ difficulty: 'easy', seed: 99 });
  await Api.saveGame(id, { path: 'R', moves: 1, elapsed_ms: 1500, hints_used: 1 });
  const playing = await Api.getPlayingGame();
  ok('gra w toku do wznowienia', playing && playing.id === id && playing.path === 'R' && playing.hints_used === 1, JSON.stringify(playing));
  await Api.finishGame(id, { path: 'R', moves: 1, elapsed_ms: 2000, hints_used: 1, status: 'gaveup' });
  ok('brak gry w toku po zakończeniu', (await Api.getPlayingGame()) === null);
  const iso = m => new Date(Date.now() + m * 60000).toISOString();
  const r = await Api.importGuestGames([
    { id: 'g1', difficulty: 'easy', seed: 7, path: 'D', moves: 1, elapsed_ms: 3000, hints_used: 0, status: 'won', started_at: iso(-3), finished_at: iso(-2) },
    { id: 'g2', difficulty: 'easy', seed: 8, path: 'D', moves: 9, elapsed_ms: 3000, hints_used: 0, status: 'won', started_at: iso(-3), finished_at: iso(-2) }
  ]);
  ok('import: 1 zapisany, 1 odrzucony, oba „done”', r.saved === 1 && r.done.join() === 'g1,g2', JSON.stringify(r));
  const best = await Api.getBest();
  ok('rekord z importu', best.easy && best.easy.best_ms === 3000, JSON.stringify(best));
  const stats = await Api.getStats();
  ok('statystyki', Number(stats.played) === 2 && Number(stats.won) === 1, JSON.stringify(stats));
  const hist = await Api.getHistory(10);
  ok('historia', hist.length === 2 && hist.every(h => h.status !== 'playing'));
  await Api.setMuted(true);
  ok('wyciszenie w profilu', Api.user().muted === true);
  await Api.signOut();
  ok('wylogowano', Api.user() === null);
  e = await err(Api.signIn(u.username, 'zle-haslo-123'));
  ok('złe hasło – komunikat', e && /Złe hasło/.test(e.message), e && e.message);
  const again = await Api.signIn(u.username.toUpperCase(), u.password);
  ok('logowanie nazwą', again && again.username === u.username && again.muted === true);
  await Api.signOut();
  ok('logowanie e-mailem', (await Api.signIn(u.email, u.password)).username === u.username);
  e = await err(Api.signUp({ ...u, email: 'e2e.api2' + rnd + '@example.com' }));
  ok('zajęta nazwa – komunikat', e && /zajęta/.test(e.message), e && e.message);
  return log;
}, rnd);
out.forEach(l => console.log(l));
await browser.close();
const fails = out.filter(l => l.startsWith('FAIL')).length;
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
process.exit(fails ? 1 : 0);
```

- [ ] **Krok 2: Uruchom i potwierdź błąd**

Uruchom: `cd tools && node api-test.mjs`
Oczekiwane: błąd `ReferenceError: Api is not defined` (brak plików).

- [ ] **Krok 3: `js/supabase-config.js`**

```js
// Projekt Supabase gry. Klucz publiczny może być w kodzie strony – dostępu do danych
// pilnują zasady RLS w bazie. NIGDY nie wpisuj tu klucza secret ani service_role.
window.SUPABASE_CONFIG = {
  url: 'https://tiyvaauexqvlgpyewirt.supabase.co',
  key: 'sb_publishable_zYAZ5akuhrgRaigWM4FYGg_PvYMPI1b',
  siteUrl: 'https://justynaanalityk.github.io/Gra-maze/'
};
```

- [ ] **Krok 4: `js/api.js`**

```js
// Jedyne miejsce rozmowy z Supabase: konto, profil, gry i wyniki. Reszta gry woła tylko Api.
// Błędy mają polski `message` i `kind`: 'network' (można ponowić), 'auth' (trzeba się zalogować),
// 'data' (baza odrzuciła dane – ponawianie nic nie da).
(function (global) {
  'use strict';

  var cfg = global.SUPABASE_CONFIG;
  var client = null;
  try {
    if (global.supabase && cfg) client = global.supabase.createClient(cfg.url, cfg.key);
  } catch (e) {
    client = null;
  }

  var NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|failed to send a request/i;
  var MESSAGES = [
    [/invalid login credentials|invalid_credentials/i, 'Złe hasło, e-mail lub nazwa użytkownika.'],
    [/already registered|already been registered|user_already_exists/i, 'Konto z tym adresem e-mail już istnieje.'],
    [/database error saving new user|profiles_username_lower|duplicate key/i, 'Ta nazwa użytkownika jest już zajęta.'],
    [/password should be at least|weak.?password|password.*(short|length)/i, 'Hasło musi mieć co najmniej 8 znaków.'],
    [/rate limit|too many|too_many_requests/i, 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.'],
    [/unable to validate email|invalid email|email address .* is invalid|email_address_invalid/i, 'Nieprawidłowy adres e-mail.'],
    [/same.?password|different from the old/i, 'Nowe hasło musi się różnić od obecnego.'],
    [NETWORK_RE, 'Brak połączenia z serwerem.']
  ];

  function toError(err, kind) {
    var raw = (err && (err.message || err.error_description || err.error || err.msg)) || String(err);
    var status = err && err.status;
    var code = err && err.code;
    var msg = 'Coś poszło nie tak. Spróbuj ponownie.';
    for (var i = 0; i < MESSAGES.length; i++) {
      if (MESSAGES[i][0].test(raw)) { msg = MESSAGES[i][1]; break; }
    }
    if (!kind) {
      if (NETWORK_RE.test(raw) || status === 0) kind = 'network';
      else if (status === 401 || status === 403 || code === '42501' || code === 'PGRST301' || /jwt/i.test(raw)) kind = 'auth';
      else kind = 'data';
    }
    var e = new Error(msg);
    e.kind = kind;
    e.raw = raw;
    return e;
  }

  function need() {
    if (!client) throw toError({ message: 'Failed to fetch' });
    return client;
  }

  function unwrap(res) {
    if (res.error) throw toError(res.error);
    return res.data;
  }

  // Każde wywołanie zwraca Promise, a każdy błąd ma `kind`.
  function run(fn) {
    return Promise.resolve().then(fn).catch(function (e) {
      throw e && e.kind ? e : toError(e);
    });
  }

  var currentUser = null;
  var accessToken = null;
  var listeners = [];
  var recoveryListeners = [];
  var recovery = false;

  function emit() {
    listeners.forEach(function (fn) { fn(currentUser); });
  }

  function refreshUser(session) {
    accessToken = session ? session.access_token : null;
    if (!session || !session.user || session.user.is_anonymous) {
      currentUser = null;
      emit();
      return Promise.resolve(null);
    }
    var u = session.user;
    return client.from('profiles').select('username, muted, created_at').eq('id', u.id).maybeSingle().then(function (res) {
      var p = unwrap(res);
      if (!p) throw toError({ message: 'Brak profilu gracza' }, 'auth');
      currentUser = { id: u.id, email: u.email, username: p.username, muted: p.muted, created_at: p.created_at };
      emit();
      return currentUser;
    });
  }

  function gameFields(s) {
    return { path: s.path, moves: s.moves, elapsed_ms: s.elapsed_ms, hints_used: s.hints_used };
  }

  var Api = {
    available: function () { return !!client; },
    user: function () { return currentUser; },
    onChange: function (fn) { listeners.push(fn); },
    onRecovery: function (fn) {
      recoveryListeners.push(fn);
      if (recovery) fn();
    },

    // Odczyt zapamiętanej sesji i nasłuch zmian (wylogowanie, link z maila do nowego hasła).
    init: function () {
      if (!client) return Promise.resolve(null);
      client.auth.onAuthStateChange(function (event, session) {
        accessToken = session ? session.access_token : null;
        if (event === 'SIGNED_OUT' && currentUser) {
          currentUser = null;
          emit();
        }
        if (event === 'PASSWORD_RECOVERY') {
          recovery = true;
          // W callbacku nie wolno czekać na inne wywołania supabase-js – stąd setTimeout.
          setTimeout(function () {
            refreshUser(session).catch(function () {});
            recoveryListeners.forEach(function (fn) { fn(); });
          }, 0);
        }
      });
      return run(function () {
        return client.auth.getSession().then(function (res) { return refreshUser(unwrap(res).session); });
      });
    },

    usernameAvailable: function (name) {
      return run(function () { return need().rpc('username_available', { name: name }).then(unwrap); });
    },

    signUp: function (o) {
      return run(function () {
        return need().auth.signUp({
          email: o.email.trim(),
          password: o.password,
          options: { data: { username: o.username.trim() } }
        }).then(function (res) {
          var d = unwrap(res);
          if (!d.session) throw toError({ message: 'Konto wymaga potwierdzenia adresu e-mail.' });
          return refreshUser(d.session);
        });
      });
    },

    // identifier: e-mail (zawiera @) albo nazwa użytkownika (przez funkcję login na serwerze).
    signIn: function (identifier, password) {
      return run(function () {
        var c = need();
        var id = identifier.trim();
        if (id.indexOf('@') !== -1) {
          return c.auth.signInWithPassword({ email: id, password: password }).then(function (res) {
            return refreshUser(unwrap(res).session);
          });
        }
        return c.functions.invoke('login', { body: { username: id, password: password } }).then(function (res) {
          if (res.error) {
            var ctx = res.error.context;
            var body = ctx && typeof ctx.json === 'function' ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
            return body.then(function (b) {
              throw toError({ message: (b && b.error) || res.error.message, status: ctx && ctx.status });
            });
          }
          return c.auth.setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token })
            .then(function (r) { return refreshUser(unwrap(r).session); });
        });
      });
    },

    signOut: function () {
      return run(function () {
        return need().auth.signOut({ scope: 'local' }).then(function () {
          accessToken = null;
          if (currentUser) { currentUser = null; emit(); }
        });
      });
    },

    resetPassword: function (email) {
      return run(function () {
        return need().auth.resetPasswordForEmail(email.trim(), { redirectTo: cfg.siteUrl }).then(unwrap);
      });
    },

    updatePassword: function (password) {
      return run(function () {
        return need().auth.updateUser({ password: password }).then(function (res) {
          unwrap(res);
          recovery = false;
        });
      });
    },

    setMuted: function (muted) {
      var u = currentUser;
      if (!u) return Promise.resolve();
      u.muted = muted;
      return run(function () {
        return need().from('profiles').update({ muted: muted }).eq('id', u.id).then(unwrap);
      });
    },

    startGame: function (s) {
      return run(function () {
        return need().from('games').insert({ difficulty: s.difficulty, seed: s.seed }).select('id').single()
          .then(function (res) { return unwrap(res).id; });
      });
    },

    saveGame: function (id, s) {
      return run(function () {
        return need().from('games').update(gameFields(s)).eq('id', id).then(unwrap);
      });
    },

    // Zapis przy zamykaniu karty: fetch z keepalive przeżywa zamknięcie strony.
    saveGameBeacon: function (id, s) {
      if (!client || !accessToken) return;
      try {
        global.fetch(cfg.url + '/rest/v1/games?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          keepalive: true,
          headers: {
            apikey: cfg.key,
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(gameFields(s))
        }).catch(function () {});
      } catch (e) { /* strona się zamyka – nic więcej nie zrobimy */ }
    },

    finishGame: function (id, s) {
      return run(function () {
        var f = gameFields(s);
        f.status = s.status;
        return need().from('games').update(f).eq('id', id).then(unwrap);
      });
    },

    getPlayingGame: function () {
      return run(function () {
        return need().from('games')
          .select('id, difficulty, seed, path, moves, elapsed_ms, hints_used, started_at')
          .eq('status', 'playing').maybeSingle().then(unwrap);
      });
    },

    getBest: function () {
      return run(function () {
        return need().from('my_best').select('*').then(function (res) {
          var map = {};
          unwrap(res).forEach(function (r) { map[r.difficulty] = r; });
          return map;
        });
      });
    },

    getStats: function () {
      return run(function () {
        return need().from('my_stats').select('*').single().then(unwrap);
      });
    },

    getHistory: function (limit) {
      return run(function () {
        return need().from('games')
          .select('difficulty, status, elapsed_ms, moves, hints_used, started_at, finished_at')
          .neq('status', 'playing').order('started_at', { ascending: false }).limit(limit).then(unwrap);
      });
    },

    // Wyniki gościa wysyłamy po jednym: odrzucony przez bazę nie blokuje pozostałych.
    // Błąd sieci lub sesji przerywa – reszta zostaje w kolejce na później.
    importGuestGames: function (items) {
      var saved = 0;
      var done = [];
      var i = 0;
      function next() {
        if (i >= items.length) return { saved: saved, done: done };
        var it = items[i++];
        return need().rpc('import_guest_games', { items: [it] }).then(function (res) {
          if (res.error) {
            var e = toError(res.error);
            if (e.kind !== 'data') throw e;
          } else {
            saved += res.data;
          }
          done.push(it.id);
          return next();
        });
      }
      return run(next);
    }
  };

  global.Api = Api;
})(window);
```

- [ ] **Krok 5: Uruchom test `Api`**

Uruchom: `cd tools && node api-test.mjs`
Oczekiwane: wszystkie `OK` i `Wszystko OK`.

- [ ] **Krok 6: Usuń konta testowe**

Uruchom: `node tools/supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@example.com'" logout`. Jeśli sesja panelu wygasła, użytkowniczka loguje się ponownie.

- [ ] **Krok 7: Commit**

```bash
git add js/supabase-config.js js/api.js tools/api-test.mjs
git commit -m "Api: konto, profil, gry i wyniki w Supabase w jednym miejscu

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 7: Ekran konta (`AuthUI`) i ochrona pól formularzy przed sterowaniem

**Pliki:**
- Zmiana: `js/input.js` (ignorowanie wpisywania)
- Nowy: `js/auth-ui.js`
- Zmiana: `index.html` (sekcja `#auth`)
- Zmiana: `style.css` (style formularzy)
- Zmiana: `tests.html` (`<script src="js/input.js"></script>` i test)

**Interfejsy:**
- Wykorzystuje: `Api.signIn`, `Api.signUp`, `Api.usernameAvailable`, `Api.resetPassword` i `Api.updatePassword` (Zadanie 6).
- Udostępnia:
  - `AuthUI.init({ onClose(), onSuccess() })`;
  - `AuthUI.open(mode, reason?)`, gdzie `mode` to `'login'`, `'register'`, `'forgot'` albo `'newpass'`. `AuthUI` nie przełącza ekranów, robi to `main.js`;
  - `Input.isTyping(event) → boolean`.

- [ ] **Krok 1: Test w `tests.html` (przed `// ---- Uruchomienie ----`; dodaj też `<script src="js/input.js"></script>` po `js/guest.js`)**

```js
      // ---- Sterowanie ----

      test('Pisanie w polach formularza nie porusza graczem ani nie wywołuje skrótów', function () {
        var moves = [], keys = [];
        Input.init({ onMove: function (d) { moves.push(d); }, onKey: function (e) { keys.push(e.key); } });
        var input = document.createElement('input');
        document.body.appendChild(input);
        ['w', 'a', 's', 'd', 'm', 'h', 'r'].forEach(function (k) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: 'Key' + k.toUpperCase(), bubbles: true }));
        });
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
        assertEqual(moves.length + keys.length, 0, 'zdarzenia z pola tekstowego');
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true }));
        assertEqual(moves.join(','), 'up', 'ruch poza polem tekstowym');
        assertEqual(keys.join(','), 'm', 'skrót poza polem tekstowym');
        input.remove();
      });
```

- [ ] **Krok 2: Uruchom i potwierdź błąd**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `✘ Pisanie w polach formularza…` z błędem `zdarzenia z pola tekstowego: oczekiwano 0, jest 8`.

- [ ] **Krok 3: `js/input.js`, czyli ignorowanie klawiszy wpisywanych w pola**

Po funkcji `dirFromEvent` dodaj:
```js
  // Klawisze wpisywane w pola formularza (logowanie, profil) nie sterują grą.
  function isTyping(e) {
    var t = e.target;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
```
W obsłudze `keydown`, zaraz po `if (e.ctrlKey || e.metaKey || e.altKey) return;`, dodaj:
```js
      if (isTyping(e)) return;
```
Na końcu pliku zamień `global.Input = { init: init };` na:
```js
  global.Input = { init: init, isTyping: isTyping };
```

- [ ] **Krok 4: Uruchom testy**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `Wszystkie testy przeszły (28)`

- [ ] **Krok 5: Sekcja `#auth` w `index.html` (wewnątrz `<main id="app">`, po sekcji `#game`)**

```html
    <!-- Konto: logowanie, rejestracja, reset i nowe hasło -->
    <section id="auth" class="screen auth" hidden>
      <div class="auth-card">
        <button id="auth-close" type="button" class="link-btn auth-close">← Graj bez logowania</button>
        <p class="kicker"><span>Konto gracza</span></p>
        <h2 id="auth-title">Zaloguj się</h2>
        <p id="auth-reason" class="auth-reason" hidden></p>
        <div class="tabs" role="tablist">
          <button id="tab-login" type="button" role="tab" aria-selected="true">Zaloguj</button>
          <button id="tab-register" type="button" role="tab" aria-selected="false">Załóż konto</button>
        </div>

        <form id="form-login" class="auth-form" novalidate>
          <label>E-mail lub nazwa użytkownika
            <input id="login-id" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
          <label>Hasło
            <input id="login-password" type="password" autocomplete="current-password" required></label>
          <p id="login-error" class="form-error" role="alert" hidden></p>
          <button type="submit" class="primary">Zaloguj się</button>
          <button id="btn-forgot" type="button" class="link-btn">Nie pamiętasz hasła?</button>
        </form>

        <form id="form-register" class="auth-form" novalidate hidden>
          <label>Nazwa użytkownika
            <input id="reg-username" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required>
            <span id="reg-username-hint" class="field-hint">3–20 znaków: litery, cyfry, _</span></label>
          <label>E-mail
            <input id="reg-email" type="email" autocomplete="email" required></label>
          <label>Hasło
            <input id="reg-password" type="password" autocomplete="new-password" minlength="8" required>
            <span class="field-hint">Co najmniej 8 znaków</span></label>
          <label>Powtórz hasło
            <input id="reg-password2" type="password" autocomplete="new-password" required></label>
          <label class="check"><input id="reg-adult" type="checkbox" required> Potwierdzam, że mam ukończone 18 lat</label>
          <p id="register-error" class="form-error" role="alert" hidden></p>
          <button type="submit" class="primary">Załóż konto</button>
        </form>

        <form id="form-forgot" class="auth-form" novalidate hidden>
          <p class="form-intro">Podaj e-mail konta – wyślemy link do ustawienia nowego hasła.</p>
          <label>E-mail
            <input id="forgot-email" type="email" autocomplete="email" required></label>
          <p id="forgot-error" class="form-error" role="alert" hidden></p>
          <p id="forgot-ok" class="form-ok" role="status" hidden>Jeśli konto istnieje, wysłaliśmy link. Sprawdź skrzynkę.</p>
          <button type="submit" class="primary">Wyślij link</button>
          <button id="btn-forgot-back" type="button" class="link-btn">Wróć do logowania</button>
        </form>

        <form id="form-newpass" class="auth-form" novalidate hidden>
          <p class="form-intro">Ustaw nowe hasło do konta.</p>
          <label>Nowe hasło
            <input id="newpass" type="password" autocomplete="new-password" minlength="8" required></label>
          <label>Powtórz hasło
            <input id="newpass2" type="password" autocomplete="new-password" required></label>
          <p id="newpass-error" class="form-error" role="alert" hidden></p>
          <button type="submit" class="primary">Zapisz hasło</button>
        </form>
      </div>
    </section>
```

- [ ] **Krok 6: `js/auth-ui.js`**

```js
// Ekran konta: logowanie, rejestracja, „nie pamiętam hasła” i ustawienie nowego hasła.
// Przełączanie ekranów należy do main.js – tu tylko formularze.
(function (global) {
  'use strict';

  var USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TITLES = { login: 'Zaloguj się', register: 'Załóż konto', forgot: 'Nie pamiętasz hasła?', newpass: 'Nowe hasło' };
  var ERRORS = ['login-error', 'register-error', 'forgot-error', 'newpass-error'];

  function $(id) { return document.getElementById(id); }

  var forms = { login: $('form-login'), register: $('form-register'), forgot: $('form-forgot'), newpass: $('form-newpass') };
  var opts = { onClose: function () {}, onSuccess: function () {} };
  var checkTimer = null;
  var checkSeq = 0;

  function showError(id, msg) {
    var p = $(id);
    p.textContent = msg || '';
    p.hidden = !msg;
  }

  function setMode(mode) {
    Object.keys(forms).forEach(function (k) { forms[k].hidden = k !== mode; });
    $('auth-title').textContent = TITLES[mode];
    document.querySelector('#auth .tabs').hidden = mode !== 'login' && mode !== 'register';
    $('tab-login').setAttribute('aria-selected', String(mode === 'login'));
    $('tab-register').setAttribute('aria-selected', String(mode === 'register'));
    $('auth-close').hidden = mode === 'newpass';
    ERRORS.forEach(function (id) { showError(id, ''); });
    $('forgot-ok').hidden = true;
    var first = forms[mode].querySelector('input');
    if (first) first.focus();
  }

  // Wspólna obsługa formularza: sprawdzenie danych, blokada przycisku, komunikat błędu.
  function handle(form, errorId, action) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problem = action.validate();
      if (problem) { showError(errorId, problem); return; }
      showError(errorId, '');
      var button = form.querySelector('button[type=submit]');
      button.disabled = true;
      action.send().then(function () {
        button.disabled = false;
        action.done();
      }, function (err) {
        button.disabled = false;
        showError(errorId, err.message);
      });
    });
  }

  handle(forms.login, 'login-error', {
    validate: function () {
      if (!$('login-id').value.trim() || !$('login-password').value) return 'Wpisz e-mail lub nazwę użytkownika i hasło.';
    },
    send: function () { return Api.signIn($('login-id').value, $('login-password').value); },
    done: function () { $('login-password').value = ''; opts.onSuccess(); }
  });

  handle(forms.register, 'register-error', {
    validate: function () {
      var p = $('reg-password').value;
      if (!USERNAME_RE.test($('reg-username').value.trim())) return 'Nazwa użytkownika: 3–20 znaków, tylko litery, cyfry i _.';
      if (!EMAIL_RE.test($('reg-email').value.trim())) return 'Wpisz poprawny adres e-mail.';
      if (p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
      if (p !== $('reg-password2').value) return 'Hasła nie są takie same.';
      if (!$('reg-adult').checked) return 'Gra jest przeznaczona wyłącznie dla osób pełnoletnich.';
    },
    send: function () {
      return Api.signUp({ username: $('reg-username').value, email: $('reg-email').value, password: $('reg-password').value });
    },
    done: function () {
      $('reg-password').value = $('reg-password2').value = '';
      opts.onSuccess();
    }
  });

  handle(forms.forgot, 'forgot-error', {
    validate: function () {
      if (!EMAIL_RE.test($('forgot-email').value.trim())) return 'Wpisz poprawny adres e-mail.';
    },
    send: function () { return Api.resetPassword($('forgot-email').value); },
    done: function () { $('forgot-ok').hidden = false; }
  });

  handle(forms.newpass, 'newpass-error', {
    validate: function () {
      var p = $('newpass').value;
      if (p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
      if (p !== $('newpass2').value) return 'Hasła nie są takie same.';
    },
    send: function () { return Api.updatePassword($('newpass').value); },
    done: function () {
      $('newpass').value = $('newpass2').value = '';
      opts.onSuccess();
    }
  });

  // Podpowiedź „wolna / zajęta” 400 ms po ostatnim wpisanym znaku.
  $('reg-username').addEventListener('input', function () {
    var hint = $('reg-username-hint');
    var name = this.value.trim();
    var seq = ++checkSeq;
    clearTimeout(checkTimer);
    hint.className = 'field-hint';
    if (!USERNAME_RE.test(name)) { hint.textContent = '3–20 znaków: litery, cyfry, _'; return; }
    hint.textContent = 'Sprawdzam…';
    checkTimer = setTimeout(function () {
      Api.usernameAvailable(name).then(function (free) {
        if (seq !== checkSeq) return;
        hint.textContent = free ? '✓ wolna' : '✗ zajęta';
        hint.className = 'field-hint ' + (free ? 'ok' : 'bad');
      }, function () {
        if (seq === checkSeq) hint.textContent = 'Nie udało się sprawdzić nazwy.';
      });
    }, 400);
  });

  $('tab-login').addEventListener('click', function () { setMode('login'); });
  $('tab-register').addEventListener('click', function () { setMode('register'); });
  $('btn-forgot').addEventListener('click', function () {
    var id = $('login-id').value.trim();
    if (id.indexOf('@') !== -1) $('forgot-email').value = id;
    setMode('forgot');
  });
  $('btn-forgot-back').addEventListener('click', function () { setMode('login'); });
  $('auth-close').addEventListener('click', function () { opts.onClose(); });

  global.AuthUI = {
    init: function (o) { opts = o; },
    open: function (mode, reason) {
      $('auth-reason').textContent = reason || '';
      $('auth-reason').hidden = !reason;
      setMode(mode || 'login');
    }
  };
})(window);
```

- [ ] **Krok 7: Style w `style.css` (przed blokiem `@keyframes fade-in`)**

```css
/* ---- Konto: ekran logowania i profilu ---- */

.auth,
.profile {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
  padding: 8px 0;
}

.auth-card,
.profile-card {
  width: min(440px, 100%);
  margin: auto;
  padding: 1.4rem 1.6rem 1.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 30px 80px -30px rgba(var(--shadow), 0.4);
  animation: rise 0.4s cubic-bezier(.2,.7,.2,1) both;
}
.profile-card { width: min(580px, 100%); }

.auth-card h2,
.profile-card h2 {
  margin: 0.1rem 0 0.9rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 2.2rem;
  letter-spacing: -0.02em;
}

button.link-btn {
  padding: 0.2em 0.1em;
  border: 0;
  background: none;
  box-shadow: none;
  color: var(--text);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--thread);
  text-underline-offset: 3px;
}
button.link-btn:hover:not(:disabled) { box-shadow: none; text-decoration-thickness: 2px; }
.auth-close { margin-bottom: 0.9rem; }

.auth-reason {
  margin: 0 0 1rem;
  padding: 0.6em 0.9em;
  border-left: 4px solid var(--goal);
  border-radius: 8px;
  background: color-mix(in srgb, var(--goal) 14%, transparent);
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid var(--border);
}
.tabs button {
  border: 0;
  border-radius: 8px 8px 0 0;
  background: none;
  box-shadow: none;
  color: var(--muted);
}
.tabs button[aria-selected="true"] { color: var(--text); box-shadow: inset 0 -3px 0 var(--thread); }

.auth-form { display: grid; gap: 0.85rem; }
.auth-form label { display: grid; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; }
.auth-form input:not([type="checkbox"]) {
  font: inherit;
  font-weight: 400;
  padding: 0.6em 0.8em;
  color: var(--text);
  background: var(--board);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.auth-form input:focus-visible { outline: 2px solid var(--trail); outline-offset: 1px; }
.auth-form .primary { justify-self: start; }
.form-intro { margin: 0; color: var(--muted); }
label.check { display: flex; align-items: center; gap: 0.55rem; font-weight: 500; }
label.check input { width: 1.1em; height: 1.1em; accent-color: var(--thread); }

.field-hint { font-size: 0.78rem; font-weight: 500; color: var(--muted); }
.field-hint.ok { color: var(--trail); }
.field-hint.bad { color: var(--thread); }
.form-error,
.form-ok { margin: 0; font-size: 0.88rem; font-weight: 600; }
.form-error { color: var(--thread); }
.form-ok { color: var(--trail); }
```

- [ ] **Krok 8: Podgląd ekranu**

Dodaj tymczasowo `js/supabase-config.js`, `js/api.js` i `js/auth-ui.js` do `index.html` (ostatecznie zrobi to Zadanie 8). W konsoli przeglądarki wpisz: `document.getElementById('menu').hidden = true; document.getElementById('auth').hidden = false; AuthUI.open('register')`. Sprawdź:
- przełączanie zakładek;
- podpowiedź nazwy „✓ wolna”;
- komunikaty walidacji po kliknięciu „Załóż konto” z pustymi polami;
- wygląd w jasnym i ciemnym motywie.

Cofnij tymczasowe `<script>`, jeśli Zadanie 8 nie idzie zaraz potem.

- [ ] **Krok 9: Commit**

```bash
git add js/input.js js/auth-ui.js index.html style.css tests.html
git commit -m "Ekran konta: logowanie, rejestracja i reset hasła

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 8: Gra z kontem – tryb gościa, autozapis, wznawianie, menu

**Pliki:**
- Przepisany: `js/main.js`
- Zmiana: `js/storage.js` (tylko wyciszenie)
- Zmiana: `index.html` (pasek konta, „Wznów”, znacznik zapisu, przyciski „Zaloguj się, aby go zapisać”, toast, skrypty)
- Zmiana: `style.css`

**Interfejsy:**
- Wykorzystuje:
  - `Game`, `game.snapshot()` i `Game.restore()` (Zadanie 1);
  - `GuestResults` (Zadanie 2);
  - `Api` (Zadanie 6);
  - `AuthUI` (Zadanie 7);
  - `ProfileUI.init({ onBack(), onLogout(), onMuteChange(bool) })` i `ProfileUI.open()` (Zadanie 9).
- Udostępnia: nic nowego dla innych plików.

> `ProfileUI` powstaje w Zadaniu 9. Żeby gra działała po tym zadaniu, krok 1 dodaje minimalny `js/profile.js`, który Zadanie 9 zastąpi.

- [ ] **Krok 1: Tymczasowy `js/profile.js`**

```js
// Ekran „Mój profil” – pełna wersja w kolejnym kroku planu.
(function (global) {
  'use strict';
  var opts = null;
  global.ProfileUI = {
    init: function (o) { opts = o; },
    open: function () { opts.onBack(); }
  };
})(window);
```

- [ ] **Krok 2: `js/storage.js`, w którym zostaje tylko wyciszenie**

```js
// Zapis w localStorage: wyciszenie dźwięku gościa (zalogowanym zapisuje się w profilu).
// Nazwa GameStorage, bo `Storage` to wbudowany typ przeglądarki.
(function (global) {
  'use strict';

  var PREFIX = 'labirynt.';

  // localStorage potrafi rzucić wyjątek (tryb prywatny, zablokowane dane) – gra ma działać mimo to.
  function read(key) {
    try {
      return global.localStorage.getItem(PREFIX + key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(PREFIX + key, value);
    } catch (e) { /* brak zapisu nie psuje gry */ }
  }

  function isMuted() {
    return read('muted') === '1';
  }

  function setMuted(muted) {
    write('muted', muted ? '1' : '0');
  }

  global.GameStorage = {
    isMuted: isMuted,
    setMuted: setMuted
  };
})(window);
```

- [ ] **Krok 3: Zmiany w `index.html`**

(a) Na początku `.menu-card`, przed `<p class="kicker">`:
```html
          <div class="account-bar">
            <span id="account-status" class="account-status">Grasz jako gość</span>
            <button id="btn-login" type="button" class="link-btn">Zaloguj się / Załóż konto</button>
            <button id="btn-profile" type="button" class="link-btn" hidden>Mój profil</button>
            <button id="btn-logout" type="button" class="link-btn" hidden>Wyloguj</button>
          </div>
```
(b) Tuż przed `<div class="levels">`:
```html
          <button id="btn-resume" type="button" class="resume" hidden></button>
```
(c) W `.stats` paska gry, po statystyce „Ruchy”:
```html
          <span id="save-state" class="save-state" title="Postęp zapisze się, gdy wróci połączenie" hidden>niezapisane</span>
```
(d) W pasku `#endbar`, po `<p>…</p>`, zamień tekst akapitu i dodaj przycisk:
```html
        <p><b>Oto droga do mety.</b></p>
        <button id="end-login" type="button" class="link-btn" hidden>Zaloguj się, aby zapisać wynik</button>
```
(e) W panelu wygranej, po `<dl class="results">…</dl>`:
```html
          <p id="ov-guest" class="guest-note" hidden>Ten wynik nie jest jeszcze zapisany.
            <button id="ov-login" type="button" class="link-btn">Zaloguj się, aby go zapisać</button></p>
```
(f) Przed `</main>`:
```html
    <p id="toast" class="toast" role="status" hidden></p>
```
(g) Skrypty: zamień cały blok `<script>` na końcu pliku na:
```html
  <!-- Supabase (konto i zapis wyników). Bez internetu gra działa jako gość. -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"></script>
  <!-- Zwykłe skrypty (bez modułów ES), żeby gra działała po otwarciu pliku dwuklikiem. -->
  <script src="js/supabase-config.js"></script>
  <script src="js/maze.js"></script>
  <script src="js/game.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/guest.js"></script>
  <script src="js/api.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/render.js"></script>
  <script src="js/preview.js"></script>
  <script src="js/input.js"></script>
  <script src="js/auth-ui.js"></script>
  <script src="js/profile.js"></script>
  <script src="js/main.js"></script>
```
(h) Akapit `.note` w menu zamień na:
```html
          <p class="note">Gra przeznaczona wyłącznie dla osób pełnoletnich. Załóż konto, aby zapisywać wyniki i wznawiać gry na każdym urządzeniu.</p>
```

- [ ] **Krok 4: Style w `style.css` (dopisz pod stylami z Zadania 7)**

```css
.account-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 12px;
  margin: 0 0 1.4rem;
  font-size: 0.85rem;
}
.account-status { font-weight: 600; color: var(--muted); }

.resume {
  width: 100%;
  justify-content: flex-start;
  margin: 0 0 10px;
  padding: 0.85rem 1rem;
  border-left: 4px solid var(--thread);
  font-weight: 700;
  text-align: left;
}

.save-state { font-size: 0.75rem; font-weight: 700; color: var(--thread); }
.guest-note { margin: 0 0 1rem; font-size: 0.9rem; color: var(--muted); }

.toast {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 10;
  width: max-content;
  max-width: min(92vw, 440px);
  margin: 0;
  padding: 0.7em 1.1em;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
  box-shadow: 0 12px 30px -10px rgba(var(--shadow), 0.5);
  animation: fade-in 0.25s ease-out;
}
```
Dodaj też regułę opóźnienia animacji dla nowego, siódmego elementu `.menu-card`:
```css
.menu-card > :nth-child(7) { animation-delay: 0.3s; }
```

- [ ] **Krok 5: Nowy `js/main.js`**

```js
// Spina całość: ekrany, konto gracza, zapis gier, pasek informacji, pętla rysowania i zdarzenia.
(function () {
  'use strict';

  var WIN_OVERLAY_DELAY = 700; // chwila na konfetti przed ekranem wygranej
  var SAVE_DELAY = 3000;       // postęp zapisujemy najwyżej co 3 s
  var RETRY_DELAY = 5000;      // ponowienie nieudanego zapisu
  var TOAST_MS = 4500;
  var GUEST_SAVE_REASON = 'Zaloguj się lub załóż konto, aby zapisać ten wynik.';

  function $(id) { return document.getElementById(id); }

  var el = {
    menu: $('menu'),
    game: $('game'),
    auth: $('auth'),
    profile: $('profile'),
    boardWrap: $('board-wrap'),
    canvas: $('board'),
    level: $('hud-level'),
    time: $('hud-time'),
    moves: $('hud-moves'),
    saveState: $('save-state'),
    hint: $('btn-hint'),
    hintCount: $('hint-count'),
    restart: $('btn-restart'),
    giveUp: $('btn-giveup'),
    mute: $('btn-mute'),
    toMenu: $('btn-menu'),
    overlay: $('overlay'),
    ovRecord: $('ov-record'),
    ovTime: $('ov-time'),
    ovMoves: $('ov-moves'),
    ovBest: $('ov-best'),
    ovGuest: $('ov-guest'),
    ovLogin: $('ov-login'),
    ovNext: $('ov-next'),
    ovMenu: $('ov-menu'),
    endbar: $('endbar'),
    endLogin: $('end-login'),
    endNext: $('end-next'),
    endMenu: $('end-menu'),
    accountStatus: $('account-status'),
    login: $('btn-login'),
    toProfile: $('btn-profile'),
    logout: $('btn-logout'),
    resume: $('btn-resume'),
    toast: $('toast')
  };

  var renderer = new Renderer(el.canvas);
  var preview = new MenuPreview($('preview'));
  var game = null;
  var difficulty = 'easy';
  var rafId = null;
  var winTimer = null;
  var toastTimer = null;
  var bests = {};        // najlepszy czas (ms) na poziom: z bazy albo z wyników gościa
  var playing = null;    // gra w toku z bazy – do przycisku „Wznów”
  var menuSeq = 0;       // spóźnione odpowiedzi z bazy nie nadpisują nowszego stanu menu
  var syncing = null;    // trwający zapis wyników gościa
  var lastUserId = null;
  var save = newSaveState();

  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return d >= 2 && d <= 4 && (t < 10 || t >= 20) ? few : many;
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, TOAST_MS);
  }

  // ---- Ekrany ----

  var SCREENS = ['menu', 'game', 'auth', 'profile'];

  function showScreen(name) {
    SCREENS.forEach(function (s) { el[s].hidden = s !== name; });
    if (name === 'menu') preview.start(); else preview.stop();
  }

  function showMenu() {
    var flushed = leaveGame();
    showScreen('menu');
    el.resume.hidden = true;
    if (!Api.user()) bests = guestBests();
    renderAccount();
    renderBests();
    var first = el.menu.querySelector('.level');
    if (first) first.focus();
    flushed.then(refreshMenu);
  }

  // Dane menu z bazy: najpierw zapis wyników gościa, potem rekordy i gra w toku.
  function refreshMenu() {
    if (el.menu.hidden) return;
    var seq = ++menuSeq;
    if (!Api.user()) {
      playing = null;
      bests = guestBests();
      renderAccount();
      renderBests();
      renderResume();
      return;
    }
    syncGuestResults()
      .then(function () { return Promise.all([Api.getBest(), Api.getPlayingGame()]); })
      .then(function (r) {
        if (seq !== menuSeq || el.menu.hidden) return;
        bests = {};
        Object.keys(r[0]).forEach(function (d) { bests[d] = r[0][d].best_ms; });
        playing = r[1];
        renderAccount();
        renderBests();
        renderResume();
      }, function (e) {
        if (seq !== menuSeq) return;
        if (e.kind === 'auth') onSessionLost(); else toast(e.message);
      });
  }

  function guestBests() {
    var b = {};
    Object.keys(DIFFICULTIES).forEach(function (d) { b[d] = GuestResults.best(d); });
    return b;
  }

  function renderBests() {
    var guest = !Api.user();
    var spans = document.querySelectorAll('[data-best]');
    for (var i = 0; i < spans.length; i++) {
      var b = bests[spans[i].getAttribute('data-best')];
      spans[i].textContent = b == null ? 'Brak rekordu' : 'Rekord: ' + formatTime(b) + (guest ? ' (niezapisany)' : '');
    }
  }

  function renderAccount() {
    var user = Api.user();
    var pending = GuestResults.count();
    if (user) {
      el.accountStatus.textContent = 'Zalogowano jako ' + user.username;
    } else if (!Api.available()) {
      el.accountStatus.textContent = 'Brak połączenia – wyniki zapiszą się później';
    } else {
      el.accountStatus.textContent = 'Grasz jako gość' + (pending
        ? ' (' + pending + ' ' + plural(pending, 'niezapisany wynik', 'niezapisane wyniki', 'niezapisanych wyników') + ')'
        : '');
    }
    el.login.hidden = !!user || !Api.available();
    el.toProfile.hidden = !user;
    el.logout.hidden = !user;
  }

  function renderResume() {
    if (!playing || !Api.user()) { el.resume.hidden = true; return; }
    el.resume.textContent = 'Wznów: ' + DIFFICULTIES[playing.difficulty].label + ' · ' +
      formatTime(playing.elapsed_ms) + ' · ' + playing.moves + ' ' + plural(playing.moves, 'ruch', 'ruchy', 'ruchów');
    el.resume.hidden = false;
  }

  function openAuth(mode, reason) {
    leaveGame();
    showScreen('auth');
    AuthUI.open(mode, reason);
  }

  function openProfile() {
    leaveGame();
    showScreen('profile');
    ProfileUI.open();
  }

  function logout() {
    Api.signOut().then(showMenu, showMenu);
  }

  // Wyniki gościa trafiają do bazy po zalogowaniu (i przy każdym kolejnym wejściu do menu, jeśli coś zostało).
  function syncGuestResults() {
    if (!Api.user() || !GuestResults.count()) return Promise.resolve();
    if (syncing) return syncing;
    syncing = Api.importGuestGames(GuestResults.list()).then(function (r) {
      GuestResults.remove(r.done);
      if (r.saved) toast('Zapisano ' + r.saved + ' ' + plural(r.saved, 'wynik', 'wyniki', 'wyników') + ' z gry bez logowania.');
    }, function () { /* zostają w kolejce – spróbujemy przy następnym menu */ }).then(function () {
      syncing = null;
      renderAccount();
    });
    return syncing;
  }

  // ---- Gra ----

  function startGame(diff) {
    leaveGame();
    difficulty = diff;
    game = new Game(diff);
    beginPlay();
    if (!Api.user()) return;
    var state = save;
    Api.startGame(game.snapshot()).then(function (id) {
      if (save !== state) return;
      state.id = id;
      if (isDirty()) scheduleSave(0);
    }, function (e) {
      if (save === state) onSaveError(e);
    });
  }

  function resumeGame() {
    var saved = playing;
    if (!saved) return;
    leaveGame();
    try {
      game = Game.restore(saved, performance.now());
    } catch (e) {
      toast('Nie udało się wznowić tej gry.');
      showMenu();
      return;
    }
    difficulty = game.difficulty;
    save.id = saved.id;
    save.sent = saveKey(game);
    beginPlay();
  }

  function beginPlay() {
    renderer.reset(game);
    hideOverlay();
    showScreen('game');
    el.level.textContent = DIFFICULTIES[difficulty].label + ' · ' + game.size + '×' + game.size;
    renderer.resize();
    updateHud(performance.now());
    startLoop();
  }

  // Sprząta po grze. Gra w toku zalogowanego gracza zostaje zapisana do wznowienia.
  function leaveGame() {
    var flushed = Promise.resolve();
    if (game && game.status === 'playing' && save.id) {
      flushed = saveNow(save, game.snapshot(performance.now())).catch(function () {});
    }
    stopLoop();
    clearTimeout(winTimer);
    clearTimeout(save.timer);
    save = newSaveState();
    game = null;
    hideOverlay();
    setSaveState(false);
    return flushed;
  }

  function showWinOverlay(record) {
    el.ovTime.textContent = formatTime(game.elapsed());
    el.ovMoves.textContent = String(game.moves);
    var best = bests[difficulty];
    el.ovBest.textContent = best == null ? '—' : formatTime(best);
    el.ovRecord.hidden = !record;
    el.ovGuest.hidden = !!Api.user();
    el.overlay.hidden = false;
    el.ovNext.focus();
  }

  function hideOverlay() {
    el.overlay.hidden = true;
    el.ovRecord.hidden = true;
    el.ovGuest.hidden = true;
    el.endbar.hidden = true;
    el.endLogin.hidden = true;
  }

  // ---- Zapis postępu (tylko zalogowani) ----

  function newSaveState() {
    return { id: null, timer: null, busy: null, sent: '' };
  }

  function saveKey(g) {
    return g.path + '|' + g.hintsUsed;
  }

  function isDirty() {
    return !!game && !!save.id && saveKey(game) !== save.sent;
  }

  function scheduleSave(delay) {
    if (!save.id || save.timer) return;
    var state = save;
    state.timer = setTimeout(function () {
      state.timer = null;
      if (save === state && game) saveNow(state, game.snapshot(performance.now()));
    }, delay === undefined ? SAVE_DELAY : delay);
  }

  // Wysyła stan gry. Gdy poprzedni zapis jeszcze trwa, czeka na niego.
  function saveNow(state, snap) {
    var key = snap.path + '|' + snap.hints_used;
    if (!state.id || snap.status !== 'playing' || key === state.sent) return Promise.resolve();
    if (state.busy) return state.busy.then(function () { return saveNow(state, snap); });
    state.busy = Api.saveGame(state.id, snap).then(function () {
      state.busy = null;
      state.sent = key;
      if (save === state) {
        setSaveState(false);
        if (isDirty()) scheduleSave();
      }
    }, function (e) {
      state.busy = null;
      if (save === state) onSaveError(e);
    });
    return state.busy;
  }

  // Zamykanie lub chowanie karty: zapis, który przeżyje zamknięcie strony.
  function beaconSave() {
    if (!isDirty() || game.status !== 'playing') return;
    Api.saveGameBeacon(save.id, game.snapshot(performance.now()));
    save.sent = saveKey(game);
  }

  function onSaveError(e) {
    setSaveState(true);
    if (e.kind === 'auth') { onSessionLost(); return; }
    clearTimeout(save.timer);
    save.timer = null;
    scheduleSave(RETRY_DELAY);
  }

  function setSaveState(failed) {
    el.saveState.hidden = !failed;
  }

  function onSessionLost() {
    clearTimeout(save.timer);
    save.id = null;
    setSaveState(false);
    toast('Sesja wygasła. Zaloguj się ponownie, aby zapisywać wyniki.');
    Api.signOut().catch(function () {});
    renderAccount();
  }

  // Wynik zakończonej gry: do bazy, a gdy się nie da – do wyników gościa (zapiszą się po zalogowaniu).
  function finishResult(snap) {
    var state = save;
    clearTimeout(state.timer);
    state.timer = null;
    if (Api.user() && state.id) {
      var id = state.id;
      state.id = null; // w tej grze nic więcej nie zapisujemy
      (state.busy || Promise.resolve()).then(function () { return Api.finishGame(id, snap); })
        .then(null, function () { GuestResults.add(snap); renderAccount(); });
      return;
    }
    if (snap.status === 'won' || snap.moves > 0) GuestResults.add(snap);
  }

  function recordResult(snap) {
    var prev = bests[snap.difficulty];
    var record = snap.status === 'won' && (prev == null || snap.elapsed_ms < prev);
    if (record) bests[snap.difficulty] = snap.elapsed_ms;
    return record;
  }

  // ---- Pętla ----

  function loop(now) {
    if (!game) return;
    renderer.draw(game, now);
    // Znacznik z requestAnimationFrame bywa wcześniejszy niż czas ruchu – zegar liczymy od performance.now().
    updateHud(performance.now());
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function updateHud(now) {
    if (!game) return;
    el.time.textContent = formatTime(game.elapsed(now));
    el.moves.textContent = String(game.moves);
    el.hintCount.textContent = String(game.hintsLeft);
    el.hint.disabled = game.hintsLeft === 0 || game.status !== 'playing';
    el.giveUp.disabled = game.status !== 'playing';
  }

  // ---- Akcje gracza ----

  function move(dir) {
    if (!game || !el.overlay.hidden) return;
    Sound.unlock();
    var now = performance.now();
    var result = game.move(dir, now);
    if (result === 'moved') {
      Sound.step();
      scheduleSave();
    } else if (result === 'blocked') {
      Sound.bump();
      renderer.bump(dir, now);
    } else if (result === 'won') {
      onWin(now);
    }
  }

  function onWin(now) {
    var snap = game.snapshot(now);
    var record = recordResult(snap);
    finishResult(snap);
    Sound.win();
    renderer.startConfetti(game, now);
    winTimer = setTimeout(function () { showWinOverlay(record); }, WIN_OVERLAY_DELAY);
  }

  function hint() {
    if (!game) return;
    Sound.unlock();
    if (game.useHint()) {
      Sound.hint();
      scheduleSave();
    }
  }

  function giveUp() {
    if (!game || !game.giveUp()) return;
    var snap = game.snapshot(performance.now());
    finishResult(snap);
    el.endLogin.hidden = !!Api.user() || snap.moves === 0;
    el.endbar.hidden = false;
    renderer.resize(); // pasek zabiera trochę miejsca planszy
    el.endNext.focus();
  }

  function restart() {
    if (game) startGame(difficulty);
  }

  function toggleMute() {
    setMuted(!Sound.isMuted());
  }

  function setMuted(muted) {
    Sound.setMuted(muted);
    if (Api.user()) Api.setMuted(muted).catch(function () {});
    else GameStorage.setMuted(muted);
    renderMute();
    if (!muted) Sound.unlock();
  }

  function renderMute() {
    var muted = Sound.isMuted();
    el.mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    el.mute.setAttribute('aria-label', muted ? 'Włącz dźwięk' : 'Wycisz dźwięk');
    el.mute.title = muted ? 'Włącz dźwięk (M)' : 'Wycisz dźwięk (M)';
  }

  // ---- Zdarzenia ----

  // Po kliknięciu zdejmujemy fokus z przycisku, żeby Enter/spacja nie klikały go ponownie.
  function onClick(button, handler) {
    button.addEventListener('click', function (e) {
      handler(e);
      if (el.overlay.hidden) button.blur();
    });
  }

  var levelButtons = document.querySelectorAll('.level');
  for (var i = 0; i < levelButtons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        Sound.unlock();
        startGame(btn.getAttribute('data-difficulty'));
      });
    })(levelButtons[i]);
  }

  onClick(el.hint, hint);
  onClick(el.restart, restart);
  onClick(el.giveUp, giveUp);
  onClick(el.mute, toggleMute);
  onClick(el.toMenu, showMenu);
  onClick(el.login, function () { openAuth('login'); });
  onClick(el.toProfile, openProfile);
  onClick(el.logout, logout);
  onClick(el.resume, function () { Sound.unlock(); resumeGame(); });
  el.ovNext.addEventListener('click', restart);
  el.ovMenu.addEventListener('click', showMenu);
  el.ovLogin.addEventListener('click', function () { openAuth('login', GUEST_SAVE_REASON); });
  el.endNext.addEventListener('click', restart);
  el.endMenu.addEventListener('click', showMenu);
  el.endLogin.addEventListener('click', function () { openAuth('login', GUEST_SAVE_REASON); });

  AuthUI.init({ onClose: showMenu, onSuccess: showMenu });
  ProfileUI.init({ onBack: showMenu, onLogout: logout, onMuteChange: setMuted });

  Input.init({
    onMove: move,
    swipeTarget: el.boardWrap,
    swipeThreshold: function () {
      return Math.max(16, Math.min(40, renderer.cell * 0.9));
    },
    onKey: function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el.menu.hidden && el.game.hidden) return; // ekrany konta i profilu
      var key = e.key.toLowerCase();
      if (key === 'm') {
        toggleMute();
        return;
      }
      if (!game) return;
      if (key === 'h') hint();
      else if (key === 'r') restart();
      else if (key === 'escape') showMenu();
    }
  });

  var resizeTimer = null;
  function onResize() {
    if (!game) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderer.resize(); }, 50);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') beaconSave();
  });
  window.addEventListener('pagehide', beaconSave);

  // ---- Konto ----

  Api.onChange(function (user) {
    var id = user ? user.id : null;
    if (id === lastUserId) return;
    var wasLoggedIn = lastUserId !== null;
    lastUserId = id;
    Sound.setMuted(user ? user.muted : GameStorage.isMuted());
    renderMute();
    if (!user && wasLoggedIn && save.id) onSessionLost();
    renderAccount();
    refreshMenu();
  });

  Api.onRecovery(function () {
    leaveGame();
    showScreen('auth');
    AuthUI.open('newpass');
  });

  Sound.setMuted(GameStorage.isMuted());
  renderMute();
  showMenu();
  Api.init().catch(function () { renderAccount(); });
})();
```

- [ ] **Krok 6: Testy jednostkowe nadal przechodzą**

Uruchom: `cd tools && node unit-test.mjs`
Oczekiwane: `Wszystkie testy przeszły (28)`

- [ ] **Krok 7: Sprawdzenie ręczne w przeglądarce**

Otwórz `index.html` i sprawdź:
1. **Menu:** „Grasz jako gość” i „Zaloguj się / Załóż konto”.
2. **Wygrana jako gość** (poziom Łatwy): ekran wygranej z „Ten wynik nie jest jeszcze zapisany”, a w menu „Rekord: … (niezapisany)” i „(1 niezapisany wynik)”.
3. **„Zaloguj się, aby go zapisać”** prowadzi do rejestracji konta próbnego. Po rejestracji menu pokazuje „Zalogowano jako …”, toast „Zapisano 1 wynik…” i rekord bez dopisku.
4. **Wznowienie:** gra na poziomie Średni, kilka ruchów, Esc. Pojawia się „Wznów: Średni · … · N ruchów”, a kliknięcie odtwarza pozycję i nić.

Konsola bez błędów.

- [ ] **Krok 8: Commit**

```bash
git add js/main.js js/storage.js js/profile.js index.html style.css
git commit -m "Gra z kontem: tryb gościa, autozapis, wznawianie i zapis wyników gościa

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 9: Ekran „Mój profil”

**Pliki:**
- Przepisany: `js/profile.js`
- Zmiana: `index.html` (sekcja `#profile`)
- Zmiana: `style.css`

**Interfejsy:**
- Wykorzystuje:
  - `Api.user()`, `Api.getStats()`, `Api.getBest()`, `Api.getHistory(10)` i `Api.updatePassword()` (Zadanie 6);
  - `Sound.isMuted()` (`js/audio.js`);
  - `formatTime` i `DIFFICULTIES` (`js/game.js`).
- Udostępnia: `ProfileUI.init({ onBack(), onLogout(), onMuteChange(bool) })` i `ProfileUI.open()`, czyli to, czego używa `main.js` z Zadania 8.

- [ ] **Krok 1: Sekcja `#profile` w `index.html` (po sekcji `#auth`)**

```html
    <!-- Mój profil -->
    <section id="profile" class="screen profile" hidden>
      <div class="profile-card">
        <button id="profile-back" type="button" class="link-btn auth-close">← Menu</button>
        <p class="kicker"><span>Mój profil</span></p>
        <h2 id="profile-name"></h2>
        <p class="profile-meta"><span id="profile-email"></span> · konto od <span id="profile-since"></span></p>
        <p id="profile-error" class="form-error" role="alert" hidden></p>

        <div class="stats-grid">
          <div><b id="st-played">–</b><span>rozegrane</span></div>
          <div><b id="st-won">–</b><span>wygrane</span></div>
          <div><b id="st-gaveup">–</b><span>poddane</span></div>
          <div><b id="st-time">–</b><span>łączny czas</span></div>
        </div>

        <h3>Rekordy</h3>
        <table class="records">
          <thead><tr><th>Poziom</th><th>Czas</th><th>Ruchy</th><th>Wygrane</th></tr></thead>
          <tbody id="profile-records"></tbody>
        </table>

        <h3>Ostatnie gry</h3>
        <ol id="profile-history" class="history"></ol>

        <h3>Ustawienia</h3>
        <label class="check"><input id="profile-muted" type="checkbox"> Wycisz dźwięk</label>
        <form id="form-changepass" class="auth-form changepass" novalidate>
          <label>Nowe hasło
            <input id="cp-password" type="password" autocomplete="new-password" minlength="8" required></label>
          <label>Powtórz hasło
            <input id="cp-password2" type="password" autocomplete="new-password" required></label>
          <p id="cp-error" class="form-error" role="alert" hidden></p>
          <p id="cp-ok" class="form-ok" role="status" hidden>Hasło zmienione.</p>
          <button type="submit">Zmień hasło</button>
        </form>
        <div class="profile-actions">
          <button id="profile-logout" type="button">Wyloguj</button>
        </div>
      </div>
    </section>
```

- [ ] **Krok 2: `js/profile.js`**

```js
// Ekran „Mój profil”: dane konta, statystyki, rekordy, historia gier, dźwięk, zmiana hasła.
(function (global) {
  'use strict';

  var HISTORY_LIMIT = 10;
  var STATUS = { won: 'wygrana', gaveup: 'poddana', abandoned: 'porzucona' };

  function $(id) { return document.getElementById(id); }

  var opts = { onBack: function () {}, onLogout: function () {}, onMuteChange: function () {} };
  var loadSeq = 0;

  function showError(id, msg) {
    $(id).textContent = msg || '';
    $(id).hidden = !msg;
  }

  function date(iso, withTime) {
    var o = withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                     : { day: 'numeric', month: 'long', year: 'numeric' };
    return new Date(iso).toLocaleString('pl-PL', o);
  }

  function cell(row, text) {
    var td = document.createElement('td');
    td.textContent = text;
    row.appendChild(td);
  }

  function renderStats(s) {
    $('st-played').textContent = String(s.played);
    $('st-won').textContent = String(s.won);
    $('st-gaveup').textContent = String(s.gaveup);
    $('st-time').textContent = formatTime(Number(s.total_ms));
  }

  function renderRecords(best) {
    var body = $('profile-records');
    body.textContent = '';
    Object.keys(DIFFICULTIES).forEach(function (d) {
      var b = best[d];
      var tr = document.createElement('tr');
      cell(tr, DIFFICULTIES[d].label);
      cell(tr, b ? formatTime(b.best_ms) : '—');
      cell(tr, b ? String(b.best_moves) : '—');
      cell(tr, b ? String(b.wins) : '0');
      body.appendChild(tr);
    });
  }

  function renderHistory(list) {
    var ol = $('profile-history');
    ol.textContent = '';
    if (!list.length) {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'Nie masz jeszcze zakończonych gier.';
      ol.appendChild(empty);
      return;
    }
    list.forEach(function (g) {
      var li = document.createElement('li');
      li.className = 'history-' + g.status;
      li.textContent = date(g.started_at, true) + ' · ' + DIFFICULTIES[g.difficulty].label + ' · ' +
        formatTime(g.elapsed_ms) + ' · ' + g.moves + ' ruch.' + ' · ' + STATUS[g.status];
      ol.appendChild(li);
    });
  }

  function load() {
    var u = Api.user();
    if (!u) { opts.onBack(); return; }
    var seq = ++loadSeq;
    $('profile-name').textContent = u.username;
    $('profile-email').textContent = u.email;
    $('profile-since').textContent = date(u.created_at);
    $('profile-muted').checked = Sound.isMuted();
    ['profile-error', 'cp-error'].forEach(function (id) { showError(id, ''); });
    $('cp-ok').hidden = true;
    Promise.all([Api.getStats(), Api.getBest(), Api.getHistory(HISTORY_LIMIT)]).then(function (r) {
      if (seq !== loadSeq) return;
      renderStats(r[0]);
      renderRecords(r[1]);
      renderHistory(r[2]);
    }, function (e) {
      if (seq === loadSeq) showError('profile-error', e.message);
    });
  }

  $('profile-back').addEventListener('click', function () { opts.onBack(); });
  $('profile-logout').addEventListener('click', function () { opts.onLogout(); });
  $('profile-muted').addEventListener('change', function () { opts.onMuteChange(this.checked); });

  $('form-changepass').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('cp-password').value;
    $('cp-ok').hidden = true;
    if (p.length < 8) { showError('cp-error', 'Hasło musi mieć co najmniej 8 znaków.'); return; }
    if (p !== $('cp-password2').value) { showError('cp-error', 'Hasła nie są takie same.'); return; }
    showError('cp-error', '');
    var button = this.querySelector('button[type=submit]');
    button.disabled = true;
    Api.updatePassword(p).then(function () {
      button.disabled = false;
      $('cp-password').value = $('cp-password2').value = '';
      $('cp-ok').hidden = false;
    }, function (err) {
      button.disabled = false;
      showError('cp-error', err.message);
    });
  });

  global.ProfileUI = {
    init: function (o) { opts = o; },
    open: load
  };
})(window);
```

- [ ] **Krok 3: Style w `style.css` (pod stylami konta)**

```css
.profile-meta { margin: -0.5rem 0 1.2rem; color: var(--muted); font-size: 0.9rem; overflow-wrap: anywhere; }
.profile-card h3 {
  margin: 1.5rem 0 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.stats-grid div {
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--board);
}
.stats-grid b { font: 700 1.15rem var(--font-mono); font-variant-numeric: tabular-nums; }
.stats-grid span { font-size: 0.75rem; color: var(--muted); }

.records { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.records th,
.records td { padding: 0.45rem 0.3rem; text-align: left; border-bottom: 1px solid var(--border); }
.records th { font-size: 0.72rem; font-weight: 700; color: var(--muted); }
.records td:not(:first-child) { font-family: var(--font-mono); }

.history { margin: 0; padding-left: 1.3rem; display: grid; gap: 0.35rem; font-size: 0.9rem; }
.history .muted,
.history-abandoned { color: var(--muted); }
.history-won::marker { color: var(--goal); }

.changepass { margin-top: 0.9rem; }
.profile-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 1.4rem; }

@media (max-width: 560px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .auth-card,
  .profile-card { padding: 1.1rem 1.1rem 1.3rem; border-radius: 16px; }
}
```

- [ ] **Krok 4: Sprawdzenie ręczne**

Zaloguj się kontem próbnym z Zadania 8, wejdź w „Mój profil” i sprawdź:
- nazwę, e-mail i datę założenia konta;
- statystyki, rekordy i historię;
- przełącznik dźwięku (po powrocie ikona w grze odpowiada ustawieniu);
- zmianę hasła („Hasło zmienione.”);
- przycisk Wyloguj, który prowadzi do menu z „Grasz jako gość”.

Na koniec obejrzyj ekran przy szerokości 390 px.

- [ ] **Krok 5: Commit**

```bash
git add js/profile.js index.html style.css
git commit -m "Ekran Mój profil: statystyki, rekordy, historia, dźwięk i zmiana hasła

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Zadanie 10: Pełny test w przeglądarce, zrzuty ekranu i sprzątanie

**Pliki:**
- Nowy: `tools/e2e.mjs`

**Interfejsy:**
- Wykorzystuje: całą grę (`index.html`) na żywym projekcie Supabase.
- Wynik: raport w konsoli i zrzuty w `tools/out/` (ignorowane przez git).

- [ ] **Krok 1: `tools/e2e.mjs`**

```js
// Pełny scenariusz w Chrome: gość → wygrana → rejestracja z zapisem wyniku → wznawianie →
// logowanie nazwą i e-mailem → profil → zmiana hasła → tryb offline. Zrzuty do tools/out/.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = pathToFileURL(path.join(here, '..', 'index.html')).href;
const OUT = path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
const rnd = Math.random().toString(36).slice(2, 7);
const user = { username: 'e2e_' + rnd, email: 'e2e.ui' + rnd + '@example.com', password: 'Haslo-' + rnd + '!', password2: 'Nowe-' + rnd + '!' };
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };
const KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];

// Reguła prawej ręki – w labiryncie idealnym zawsze dochodzi do mety. Kończy po maxSteps ruchach albo na ekranie wygranej.
async function walk(page, maxSteps) {
  const moves = async () => +(await page.textContent('#hud-moves'));
  let dir = 0, steps = 0;
  while (steps < maxSteps && await page.isHidden('#overlay')) {
    const before = await moves();
    for (const turn of [1, 0, 3, 2]) {
      const d = (dir + turn) % 4;
      await page.keyboard.press(KEYS[d]);
      await page.waitForTimeout(30); // licznik ruchów odświeża się w klatce animacji
      if (await moves() !== before) { dir = d; steps++; break; }
    }
  }
  return moves();
}
const status = page => page.textContent('#account-status');

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
async function newPage(scheme = 'light', viewport = { width: 1200, height: 820 }) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return page;
}

// 1. Gość wygrywa
const page = await newPage();
await page.goto(GAME);
await page.waitForFunction(() => /gość/.test(document.getElementById('account-status').textContent));
ok('start jako gość', /Grasz jako gość/.test(await status(page)));
await page.click('[data-difficulty="easy"]');
await walk(page, 2000);
await page.waitForSelector('#overlay:not([hidden])');
ok('gość: wynik niezapisany', await page.isVisible('#ov-guest'));
await page.screenshot({ path: path.join(OUT, 'wygrana-gosc.png') });

// 2. „Zaloguj się, aby go zapisać” → rejestracja
await page.click('#ov-login');
ok('ekran konta z powodem', await page.isVisible('#auth-reason'));
await page.click('#tab-register');
await page.fill('#reg-username', user.username);
await page.waitForFunction(() => /wolna/.test(document.getElementById('reg-username-hint').textContent), null, { timeout: 10000 });
await page.fill('#reg-email', user.email);
await page.fill('#reg-password', user.password);
await page.fill('#reg-password2', user.password);
await page.screenshot({ path: path.join(OUT, 'rejestracja.png') });
await page.click('#form-register button[type=submit]');
ok('przed zaznaczeniem 18+ jest komunikat', /pełnoletnich/.test(await page.textContent('#register-error')));
await page.check('#reg-adult');
await page.click('#form-register button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
await page.waitForFunction(() => /Zapisano 1 wynik/.test(document.getElementById('toast').textContent), null, { timeout: 15000 });
ok('wynik gościa zapisany po rejestracji', true);
await page.waitForFunction(() => /Rekord: \d/.test(document.querySelector('[data-best="easy"]').textContent));
ok('rekord bez dopisku „niezapisany”', !/niezapisany/.test(await page.textContent('[data-best="easy"]')));

// 3. Wznawianie po odświeżeniu strony (i Esc tuż po ruchu – Review Focus 2)
await page.click('[data-difficulty="medium"]');
await walk(page, 6);
await page.waitForTimeout(3500); // autozapis
await walk(page, 2);
await page.keyboard.press('Escape'); // esc-po-ruchu: ostatnie 2 ruchy muszą się zapisać
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 10000 });
ok('esc-po-ruchu: „Wznów” z 8 ruchami', /8 ruchów/.test(await page.textContent('#btn-resume')), await page.textContent('#btn-resume'));
await page.reload();
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 15000 });
ok('po odświeżeniu „Wznów: Średni”', /Wznów: Średni/.test(await page.textContent('#btn-resume')));
await page.screenshot({ path: path.join(OUT, 'menu-wznow.png') });
await page.click('#btn-resume');
ok('wznowiona gra ma 8 ruchów', (await page.textContent('#hud-moves')) === '8');
const t = await page.textContent('#hud-time');
ok('wznowiona gra zachowała czas', t !== '0:00.0', t);
await page.screenshot({ path: path.join(OUT, 'gra-wznowiona.png') });
await page.keyboard.press('Escape');

// 4. Wylogowanie, złe hasło, logowanie nazwą
await page.click('#btn-logout');
await page.waitForFunction(() => /gość/.test(document.getElementById('account-status').textContent));
await page.click('#btn-login');
await page.fill('#login-id', user.username.toUpperCase());
await page.fill('#login-password', 'zle-haslo-123');
await page.click('#form-login button[type=submit]');
await page.waitForSelector('#login-error:not([hidden])', { timeout: 10000 });
ok('złe hasło – komunikat', /Złe hasło/.test(await page.textContent('#login-error')));
await page.fill('#login-password', user.password);
await page.click('#form-login button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
ok('logowanie nazwą (wielkie litery)', true);

// 5. Profil, zmiana hasła
await page.click('#btn-profile');
await page.waitForFunction(() => document.getElementById('st-played').textContent !== '–', null, { timeout: 10000 });
ok('profil: nazwa i e-mail', (await page.textContent('#profile-name')) === user.username && (await page.textContent('#profile-email')) === user.email);
ok('profil: 1 wygrana', (await page.textContent('#st-won')) === '1');
ok('profil: historia ma wygraną', /wygrana/.test(await page.textContent('#profile-history')));
await page.screenshot({ path: path.join(OUT, 'profil-jasny.png'), fullPage: true });
await page.fill('#cp-password', user.password2);
await page.fill('#cp-password2', user.password2);
await page.click('#form-changepass button[type=submit]');
await page.waitForSelector('#cp-ok:not([hidden])', { timeout: 10000 });
ok('zmiana hasła', true);
await page.click('#profile-logout');
await page.click('#btn-login');
await page.fill('#login-id', user.email);
await page.fill('#login-password', user.password2);
await page.click('#form-login button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
ok('logowanie e-mailem nowym hasłem', true);

// 6. Pisanie w polach nie steruje grą (Review Focus 1)
await page.click('#btn-logout');
await page.click('#btn-login');
const mutedBefore = await page.getAttribute('#btn-mute', 'aria-pressed');
await page.fill('#login-id', 'wasdmhr');
ok('pole loginu przyjmuje litery w/a/s/d/m/h/r', (await page.inputValue('#login-id')) === 'wasdmhr');
ok('litera m w polu nie przełącza dźwięku', (await page.getAttribute('#btn-mute', 'aria-pressed')) === mutedBefore);

// 7. Wygląd: ciemny motyw i telefon
const dark = await newPage('dark');
await dark.goto(GAME);
await dark.click('#btn-login');
await dark.screenshot({ path: path.join(OUT, 'logowanie-ciemny.png') });
const phone = await newPage('light', { width: 390, height: 844 });
await phone.goto(GAME);
await phone.screenshot({ path: path.join(OUT, 'menu-telefon.png') });
await phone.click('#btn-login');
await phone.click('#tab-register');
await phone.screenshot({ path: path.join(OUT, 'rejestracja-telefon.png') });

// 8. Offline: CDN Supabase nieosiągalny (Review Focus 4)
const off = await newPage();
await off.route('**/cdn.jsdelivr.net/**', r => r.abort());
await off.goto(GAME);
ok('offline: komunikat w menu', /Brak połączenia/.test(await status(off)), await status(off));
ok('offline: brak przycisku logowania', await off.isHidden('#btn-login'));
await off.click('[data-difficulty="easy"]');
await walk(off, 2000);
await off.waitForSelector('#overlay:not([hidden])');
ok('offline: wygrana trafia do kolejki gościa', await off.evaluate(() => GuestResults.count() === 1));

const ownErrors = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
ok('brak błędów JavaScript', ownErrors.length === 0, ownErrors.join(' | '));
await browser.close();
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
console.log('Konto testowe: ' + user.email + '   Zrzuty: ' + OUT);
process.exit(fails ? 1 : 0);
```

- [ ] **Krok 2: Uruchom**

Uruchom: `cd tools && node e2e.mjs`
Oczekiwane: wszystkie `OK` i `Wszystko OK`. Jeśli coś nie przechodzi, wróć do zadania, które jest właścicielem danego zachowania (np. „esc-po-ruchu” to `leaveGame` i `saveNow` w Zadaniu 8), popraw je i uruchom ponownie.

- [ ] **Krok 3: Obejrzyj zrzuty**

W `tools/out/` sprawdź:
- czy pliki `rejestracja.png`, `profil-jasny.png`, `logowanie-ciemny.png`, `menu-telefon.png` i `rejestracja-telefon.png` nie mają nachodzących elementów ani przewijania w poziomie;
- czy kontrast w ciemnym motywie jest czytelny.

- [ ] **Krok 4: Wszystkie testy razem**

```bash
cd tools && node unit-test.mjs && node sql-test.mjs && node live-test.mjs && node api-test.mjs && node e2e.mjs
```
Oczekiwane: każdy kończy się `Wszystko OK` lub `Wszystkie testy przeszły (28)`.

- [ ] **Krok 5: Usuń konta testowe i sesję panelu**

```bash
node tools/supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@example.com'" logout
```

- [ ] **Krok 6: Commit**

```bash
git add tools/e2e.mjs
git commit -m "Test całościowy kont, zapisu i wznawiania w przeglądarce

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Krok 7: Publikacja – tylko za zgodą użytkowniczki**

Pokaż zrzuty z `tools/out/` i zapytaj, czy opublikować. Po zgodzie:
```bash
git checkout master && git pull && git merge --no-ff baza-zapis-wynikow -m "Merge branch 'baza-zapis-wynikow'

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" && git push origin master
```
Potem sprawdź na `https://justynaanalityk.github.io/Gra-maze/`:
- rejestrację;
- „Wznów”;
- link resetu hasła: wysłany mail ma prowadzić na adres gry, a gra ma pokazać „Nowe hasło”.
