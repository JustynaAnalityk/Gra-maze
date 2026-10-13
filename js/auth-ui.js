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
