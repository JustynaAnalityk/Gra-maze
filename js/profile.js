// Ekran „Mój profil” – pełna wersja w kolejnym kroku planu.
(function (global) {
  'use strict';
  var opts = null;
  global.ProfileUI = {
    init: function (o) { opts = o; },
    open: function () { opts.onBack(); }
  };
})(window);
