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
