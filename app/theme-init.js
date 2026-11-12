/* Nastaví motiv ještě před vykreslením stránky, aby neproblikla špatná barva. */
(function () {
  var theme = 'system';
  try { theme = localStorage.getItem('piticko-theme') || 'system'; } catch (e) { /* ignore */ }
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#141B26' : '#F5F0E6');
})();
