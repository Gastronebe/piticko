/*
 * Instalace na plochu: detekce platformy, zachycení beforeinstallprompt (Android/Chrome)
 * a stav pro návod na iPhonu.
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var U = P.U;
  var deferred = null;
  var listeners = [];
  var DISMISS_KEY = 'piticko-install-dismissed';
  var DISMISS_DAYS = 14;

  function platform() {
    if (U.isStandalone()) return 'installed';
    if (U.isIOS()) return 'ios';
    if (/Android/i.test(navigator.userAgent)) return 'android';
    return 'other';
  }

  function init() {
    g.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      listeners.forEach(function (fn) { fn(); });
    });
    g.addEventListener('appinstalled', function () {
      deferred = null;
      listeners.forEach(function (fn) { fn(); });
    });
  }

  function canPrompt() { return !!deferred; }
  function prompt() {
    if (!deferred) return Promise.resolve(false);
    var e = deferred;
    deferred = null;
    e.prompt();
    return e.userChoice.then(function (c) { return c.outcome === 'accepted'; }).catch(function () { return false; });
  }
  function onChange(fn) { listeners.push(fn); }

  function dismissed() {
    try {
      var v = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return v && Date.now() - v < DISMISS_DAYS * 864e5;
    } catch (e) { return false; }
  }
  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  }

  /** Má se zobrazit nabídka instalace? */
  function shouldOffer() {
    var p = platform();
    if (p === 'installed' || dismissed()) return false;
    return p === 'ios' || canPrompt();
  }

  P.Install = { init: init, platform: platform, canPrompt: canPrompt, prompt: prompt, onChange: onChange, dismiss: dismiss, shouldOffer: shouldOffer };
})(self);
