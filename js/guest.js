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
