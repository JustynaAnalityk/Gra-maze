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
    document.body.setAttribute('data-screen', name); // CSS: rozmyty obrazek pod kontem i profilem
    // Animacje ilustracji tylko w menu – w grze nic nie rysują w tle.
    if (name === 'menu') HeroFX.start(); else HeroFX.stop();
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
