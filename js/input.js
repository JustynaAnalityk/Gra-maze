// Sterowanie: klawiatura (strzałki, WASD) i przesuwanie palcem po planszy.
(function (global) {
  'use strict';

  var REPEAT_DELAY = 170; // ms do pierwszego powtórzenia przy trzymaniu klawisza
  var REPEAT_EVERY = 80;  // ms między kolejnymi powtórzeniami

  var KEY_DIRS = {
    ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
    KeyW: 'up', KeyD: 'right', KeyS: 'down', KeyA: 'left'
  };

  function dirFromEvent(e) {
    return KEY_DIRS[e.key] || KEY_DIRS[e.code] || null;
  }

  // opts: onMove(dir), onKey(event), swipeTarget (element), swipeThreshold() -> px
  function init(opts) {
    var heldCode = null;
    var delayTimer = null;
    var repeatTimer = null;

    function stopRepeat() {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = repeatTimer = null;
      heldCode = null;
    }

    // Własne powtarzanie zamiast systemowego – równe tempo niezależnie od ustawień systemu.
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var dir = dirFromEvent(e);
      if (dir) {
        e.preventDefault();
        if (e.repeat) return;
        stopRepeat();
        heldCode = e.code || e.key;
        opts.onMove(dir);
        delayTimer = setTimeout(function () {
          repeatTimer = setInterval(function () { opts.onMove(dir); }, REPEAT_EVERY);
        }, REPEAT_DELAY);
        return;
      }
      if (!e.repeat && opts.onKey) opts.onKey(e);
    });

    document.addEventListener('keyup', function (e) {
      if ((e.code || e.key) === heldCode) stopRepeat();
    });
    global.addEventListener('blur', stopRepeat);
    document.addEventListener('visibilitychange', stopRepeat);

    // Swipe: każde przesunięcie palca o próg w danym kierunku to jeden krok,
    // więc można prowadzić gracza jednym ciągłym ruchem.
    var target = opts.swipeTarget;
    if (!target) return;
    var touch = null;

    target.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (target.setPointerCapture) target.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    target.addEventListener('pointermove', function (e) {
      if (!touch || e.pointerId !== touch.id) return;
      var dx = e.clientX - touch.x;
      var dy = e.clientY - touch.y;
      var threshold = opts.swipeThreshold ? opts.swipeThreshold() : 24;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      opts.onMove(dir);
      touch.x = e.clientX;
      touch.y = e.clientY;
      e.preventDefault();
    });

    function endTouch(e) {
      if (touch && e.pointerId === touch.id) touch = null;
    }
    target.addEventListener('pointerup', endTouch);
    target.addEventListener('pointercancel', endTouch);
  }

  global.Input = { init: init };
})(window);
