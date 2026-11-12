/*
 * Výběr jazyka a funkce t() pro překlady.
 * Funguje v okně i v service workeru (klasický skript).
 */
(function (g) {
  'use strict';
  var all = g.PITICKO_STRINGS || {};
  var DEFAULT_LANG = 'cs';
  // Zatím jediný jazyk. Až přibude další, stačí přidat jeho soubor se strings.
  var lang = DEFAULT_LANG;
  var S = all[lang] || all[DEFAULT_LANG];

  function lookup(key) {
    return key.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, S);
  }

  function t(key, params) {
    var v = lookup(key);
    if (v == null) return key;
    if (typeof v === 'function') return v(params || {});
    if (typeof v !== 'string') return v;
    if (!params) return v;
    return v.replace(/\{(\w+)\}/g, function (m, k) {
      return params[k] != null ? String(params[k]) : m;
    });
  }

  g.P = g.P || {};
  g.P.t = t;
  g.P.lang = lang;
  g.P.locale = S._locale || 'cs-CZ';
})(typeof self !== 'undefined' ? self : this);
