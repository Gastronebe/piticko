/* Pitíčko – skript pro landing page: instalace na Androidu. */
(function () {
  'use strict';

  var deferred = null;
  var installBtn = document.getElementById('android-install-btn');

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (deferred) {
        var ev = deferred;
        deferred = null;
        ev.prompt();
        return;
      }
      location.href = '/app/';
    });
  }
})();
