// Jedyne miejsce rozmowy z Supabase: konto, profil, gry i wyniki. Reszta gry woła tylko Api.
// Błędy mają polski `message` i `kind`: 'network' (można ponowić), 'auth' (trzeba się zalogować),
// 'data' (baza odrzuciła dane – ponawianie nic nie da).
(function (global) {
  'use strict';

  var cfg = global.SUPABASE_CONFIG;
  var LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js';
  var LIB_TIMEOUT = 8000;
  var client = null;
  var libFailed = false;

  // Biblioteka Supabase wczytywana w tle – gra nie czeka na nią przy starcie (wolna sieć, brak internetu).
  function loadLibrary() {
    return new Promise(function (resolve, reject) {
      if (global.supabase) { resolve(); return; }
      var script = document.createElement('script');
      var timer = setTimeout(function () { reject(new Error('Failed to fetch')); }, LIB_TIMEOUT);
      script.src = LIB_URL;
      script.async = true;
      script.onload = function () {
        clearTimeout(timer);
        if (global.supabase) resolve(); else reject(new Error('Failed to fetch'));
      };
      script.onerror = function () {
        clearTimeout(timer);
        reject(new Error('Failed to fetch'));
      };
      document.head.appendChild(script);
    });
  }

  function createClient() {
    if (!client && cfg && global.supabase) client = global.supabase.createClient(cfg.url, cfg.key);
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

  // Nasłuch zmian sesji i odczyt zapamiętanej sesji (po wczytaniu biblioteki).
  function listen() {
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
  }

  var Api = {
    // Do czasu wczytania biblioteki zakładamy, że serwer jest dostępny (nie straszymy „brakiem połączenia”).
    available: function () { return !libFailed && !!cfg; },
    user: function () { return currentUser; },
    onChange: function (fn) { listeners.push(fn); },
    onRecovery: function (fn) {
      recoveryListeners.push(fn);
      if (recovery) fn();
    },

    // Odczyt zapamiętanej sesji i nasłuch zmian (wylogowanie, link z maila do nowego hasła).
    init: function () {
      return loadLibrary().then(function () {
        createClient();
        if (!client) throw new Error('Failed to fetch');
      }).then(function () {
        return listen();
      }, function (e) {
        libFailed = true;
        throw toError(e, 'network');
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
