// Zapis w localStorage: najlepsze czasy i wyciszenie.
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

  function getBest(difficulty) {
    var v = parseFloat(read('best.' + difficulty));
    return isFinite(v) && v > 0 ? v : null;
  }

  // Zwraca true, gdy padł nowy rekord.
  function saveBest(difficulty, ms) {
    var best = getBest(difficulty);
    if (best === null || ms < best) {
      write('best.' + difficulty, String(Math.round(ms)));
      return true;
    }
    return false;
  }

  function isMuted() {
    return read('muted') === '1';
  }

  function setMuted(muted) {
    write('muted', muted ? '1' : '0');
  }

  global.GameStorage = {
    getBest: getBest,
    saveBest: saveBest,
    isMuted: isMuted,
    setMuted: setMuted
  };
})(window);
