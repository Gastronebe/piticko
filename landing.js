/* Pitíčko – skript pro landing page: přepínač vzhledu a instalace na Androidu. */
(function () {
  'use strict';

  var LABELS = { system: 'Vzhled: systém', light: 'Vzhled: světlý', dark: 'Vzhled: tmavý' };
  var ORDER = ['system', 'light', 'dark'];
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'system';
  }
  function updateMeta(theme) {
    var dark = theme === 'dark' || (theme !== 'light' && mq && mq.matches);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#141B26' : '#F5F0E6');
  }
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('piticko-theme', theme); } catch (e) { /* ignore */ }
    updateMeta(theme);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = LABELS[theme] || LABELS.system;
  }

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = LABELS[currentTheme()] || LABELS.system;
    btn.addEventListener('click', function () {
      var next = ORDER[(ORDER.indexOf(currentTheme()) + 1) % ORDER.length];
      setTheme(next);
    });
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { updateMeta(currentTheme()); });

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
