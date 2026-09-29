// Spina całość: ekrany, pasek informacji, pętla rysowania, obsługa zdarzeń.
(function () {
  'use strict';

  var WIN_OVERLAY_DELAY = 700; // chwila na konfetti przed ekranem wygranej

  function $(id) { return document.getElementById(id); }

  var el = {
    menu: $('menu'),
    game: $('game'),
    boardWrap: $('board-wrap'),
    canvas: $('board'),
    level: $('hud-level'),
    time: $('hud-time'),
    moves: $('hud-moves'),
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
    ovNext: $('ov-next'),
    ovMenu: $('ov-menu'),
    endbar: $('endbar'),
    endNext: $('end-next'),
    endMenu: $('end-menu')
  };

  var renderer = new Renderer(el.canvas);
  var game = null;
  var difficulty = 'easy';
  var rafId = null;
  var winTimer = null;

  // ---- Ekrany ----

  function showMenu() {
    stopLoop();
    clearTimeout(winTimer);
    game = null;
    hideOverlay();
    var buttons = document.querySelectorAll('[data-best]');
    for (var i = 0; i < buttons.length; i++) {
      var best = GameStorage.getBest(buttons[i].getAttribute('data-best'));
      buttons[i].textContent = best === null ? 'Brak rekordu' : 'Rekord: ' + formatTime(best);
    }
    el.game.hidden = true;
    el.menu.hidden = false;
    var first = el.menu.querySelector('.level');
    if (first) first.focus();
  }

  function startGame(diff) {
    clearTimeout(winTimer);
    difficulty = diff;
    game = new Game(diff);
    renderer.reset(game);
    hideOverlay();
    el.menu.hidden = true;
    el.game.hidden = false;
    el.level.textContent = DIFFICULTIES[diff].label + ' · ' + game.size + '×' + game.size;
    renderer.resize();
    updateHud(performance.now());
    startLoop();
  }

  function showWinOverlay(record) {
    el.ovTime.textContent = formatTime(game.elapsed());
    el.ovMoves.textContent = String(game.moves);
    var best = GameStorage.getBest(difficulty);
    el.ovBest.textContent = best === null ? '—' : formatTime(best);
    el.ovRecord.hidden = !record;
    el.overlay.hidden = false;
    el.ovNext.focus();
  }

  function hideOverlay() {
    el.overlay.hidden = true;
    el.ovRecord.hidden = true;
    el.endbar.hidden = true;
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
    } else if (result === 'blocked') {
      Sound.bump();
      renderer.bump(dir, now);
    } else if (result === 'won') {
      onWin(now);
    }
  }

  function onWin(now) {
    var record = GameStorage.saveBest(difficulty, game.elapsed(now));
    Sound.win();
    renderer.startConfetti(game, now);
    winTimer = setTimeout(function () { showWinOverlay(record); }, WIN_OVERLAY_DELAY);
  }

  function hint() {
    if (!game) return;
    Sound.unlock();
    if (game.useHint()) Sound.hint();
  }

  function giveUp() {
    if (!game || !game.giveUp()) return;
    el.endbar.hidden = false;
    renderer.resize(); // pasek zabiera trochę miejsca planszy
    el.endNext.focus();
  }

  function restart() {
    if (game) startGame(difficulty);
  }

  function toggleMute() {
    var muted = !Sound.isMuted();
    Sound.setMuted(muted);
    GameStorage.setMuted(muted);
    renderMute();
    if (!muted) Sound.unlock();
  }

  function renderMute() {
    var muted = Sound.isMuted();
    el.mute.textContent = muted ? '🔇' : '🔊';
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
  el.ovNext.addEventListener('click', restart);
  el.ovMenu.addEventListener('click', showMenu);
  el.endNext.addEventListener('click', restart);
  el.endMenu.addEventListener('click', showMenu);

  Input.init({
    onMove: move,
    swipeTarget: el.boardWrap,
    swipeThreshold: function () {
      return Math.max(16, Math.min(40, renderer.cell * 0.9));
    },
    onKey: function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

  Sound.setMuted(GameStorage.isMuted());
  renderMute();
  showMenu();
})();
