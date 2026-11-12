/*
 * Pomocné funkce: datum (vždy v lokálním čase zařízení), formátování, DOM.
 * Klasický skript, použitelný i v service workeru (kromě DOM části).
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Lokální datum jako "YYYY-MM-DD" (den končí o půlnoci místního času). */
  function dateKey(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayKey() { return dateKey(new Date()); }

  /** "YYYY-MM-DD" -> Date na lokální půlnoci. */
  function parseKey(key) {
    var p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function daysBetween(from, to) {
    var out = [];
    for (var k = from; k <= to; k = addDays(k, 1)) out.push(k);
    return out;
  }
  /** "YYYY-MM" -> [první den, poslední den]. */
  function monthRange(ym) {
    var p = ym.split('-').map(Number);
    var first = new Date(p[0], p[1] - 1, 1);
    var last = new Date(p[0], p[1], 0);
    return [dateKey(first), dateKey(last)];
  }
  function addMonths(ym, n) {
    var p = ym.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  /** Časová značka pro den + "HH:MM" v lokálním čase. */
  function timestampFor(key, hhmm) {
    var d = parseKey(key);
    var t = hhmm.split(':').map(Number);
    d.setHours(t[0], t[1], 0, 0);
    return d.getTime();
  }
  function timeOf(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function msUntilMidnight() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  var nf = null;
  function fmtNum(n) {
    if (!nf) nf = new Intl.NumberFormat(P.locale || 'cs-CZ', { maximumFractionDigits: 0 });
    return nf.format(Math.round(n));
  }
  function fmtMl(n) { return P.t('common.ml', { n: fmtNum(n) }); }

  function fmtDate(key, opts) {
    return new Intl.DateTimeFormat(P.locale || 'cs-CZ', opts || { day: 'numeric', month: 'numeric', year: 'numeric' }).format(parseKey(key));
  }
  function fmtDateShort(key) {
    return fmtDate(key, { day: 'numeric', month: 'numeric' });
  }
  function fmtDateLong(key) {
    return fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function weekdayShort(key) {
    return P.t('dates.weekdaysShort')[parseKey(key).getDay()];
  }
  function fmtMonth(ym) {
    var s = new Intl.DateTimeFormat(P.locale || 'cs-CZ', { month: 'long', year: 'numeric' }).format(parseKey(ym + '-01'));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function uuid() {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    var b = new Uint8Array(16);
    g.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function isValidTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

  /** Jednoduché vytváření DOM prvků bez innerHTML. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  function isIOS() {
    var ua = g.navigator ? g.navigator.userAgent : '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && g.navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return (g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) || g.navigator.standalone === true;
  }

  P.U = {
    pad: pad, dateKey: dateKey, todayKey: todayKey, parseKey: parseKey, addDays: addDays,
    daysBetween: daysBetween, monthRange: monthRange, addMonths: addMonths,
    timestampFor: timestampFor, timeOf: timeOf, msUntilMidnight: msUntilMidnight,
    fmtNum: fmtNum, fmtMl: fmtMl, fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtDateLong: fmtDateLong,
    weekdayShort: weekdayShort, fmtMonth: fmtMonth, uuid: uuid, isValidTime: isValidTime,
    h: h, s: s, isIOS: isIOS, isStandalone: isStandalone
  };
})(typeof self !== 'undefined' ? self : this);
