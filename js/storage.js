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
