// Efekty dźwiękowe generowane w Web Audio – bez plików.
(function (global) {
  'use strict';

  var ctx = null;
  var muted = false;

  // Przeglądarki pozwalają uruchomić dźwięk dopiero po geście użytkownika,
  // dlatego kontekst tworzymy leniwie, przy pierwszym ruchu lub kliknięciu.
  function ensure() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, type, volume, delay) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    var t = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    // Krótkie narastanie i wygaszanie, żeby nie było trzasków.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  global.Sound = {
    unlock: function () {
      if (!muted) ensure();
    },
    isMuted: function () {
      return muted;
    },
    setMuted: function (value) {
      muted = !!value;
    },
    step: function () {
      tone(560, 0.05, 'sine', 0.05);
    },
    bump: function () {
      tone(110, 0.09, 'square', 0.035);
    },
    hint: function () {
      tone(660, 0.08, 'triangle', 0.06);
      tone(880, 0.1, 'triangle', 0.06, 0.08);
    },
    win: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], i === notes.length - 1 ? 0.4 : 0.14, 'triangle', 0.08, i * 0.11);
      }
    }
  };
})(window);
