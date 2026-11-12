/*
 * Logika připomínek sdílená aplikací a service workerem.
 * Obsah upozornění se vždy skládá z lokálních dat v zařízení.
 * Texty jsou neutrální: připomínají zápis, nikdy nenabádají k pití.
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var DB = P.DB, U = P.U, t = P.t;

  var WINDOW_MS = 90 * 60 * 1000; // připomínku lze doručit až 90 minut po plánovaném čase
  var NEAR_RATIO = 0.8;

  /** Stav dneška vůči limitu: 'none' | 'ok' | 'near' | 'over'. */
  function limitState(total, limit) {
    if (!limit) return 'none';
    if (total > limit) return 'over';
    if (total >= limit * NEAR_RATIO) return 'near';
    return 'ok';
  }

  /**
   * Vrátí {title, body} nebo null (když se nemá nic zobrazit).
   * force = true: vždy něco vrátí (pro push, kde systém vyžaduje viditelnou zprávu).
   */
  function buildContent(settings, force) {
    var today = U.todayKey();
    return Promise.all([DB.getEntriesByDate(today), DB.getDayGoal(today)]).then(function (res) {
      var total = res[0].reduce(function (sum, e) { return sum + e.amountMl; }, 0);
      var title = t('notify.title');
      if (settings.mode === 'limit') {
        var limit = DB.resolveGoal(today, res[1], settings);
        var st = limitState(total, limit);
        if (st === 'near') return { title: title, body: t('notify.near') };
        if (st === 'over') return { title: title, body: t('notify.reached') };
        if (settings.reminders.onlyWhenNearLimit && !force) return null;
      }
      var body = new Date().getHours() < 12 ? t('notify.generic1') : t('notify.generic2');
      return { title: title, body: body };
    });
  }

  /** Nejnovější plánovaný čas dneška, který už nastal a ještě nebyl zobrazen. */
  function dueSlot(times, lastShownAt, now) {
    var today = U.todayKey();
    var due = null;
    (times || []).forEach(function (hhmm) {
      if (!U.isValidTime(hhmm)) return;
      var ts = U.timestampFor(today, hhmm);
      if (ts <= now && now - ts <= WINDOW_MS && ts > lastShownAt && (due === null || ts > due)) due = ts;
    });
    return due;
  }

  function permissionGranted() {
    return typeof g.Notification !== 'undefined' && g.Notification.permission === 'granted';
  }

  /**
   * Zkontroluje, zda je čas na připomínku, a případně ji zobrazí.
   * show(title, options) – funkce, která notifikaci skutečně zobrazí.
   */
  function runDue(show, now) {
    now = now || Date.now();
    return DB.getSettings().then(function (s) {
      if (!s.onboardingDone || !s.reminders.enabled || !permissionGranted()) return false;
      return DB.getMeta('reminderState').then(function (state) {
        state = state || { lastShownAt: 0 };
        var slot = dueSlot(s.reminders.times, state.lastShownAt, now);
        if (!slot) return false;
        return DB.setMeta('reminderState', { lastShownAt: slot }).then(function () {
          return buildContent(s, false);
        }).then(function (c) {
          if (!c) return false;
          return Promise.resolve(show(c.title, notificationOptions(c.body))).then(function () { return true; });
        });
      });
    });
  }

  function notificationOptions(body) {
    return {
      body: body,
      tag: 'piticko-reminder',
      icon: '/app/icons/icon-192.png',
      badge: '/app/icons/badge-96.png',
      lang: P.lang,
      data: { url: '/app/' }
    };
  }

  P.Reminders = {
    limitState: limitState,
    buildContent: buildContent,
    dueSlot: dueSlot,
    runDue: runDue,
    notificationOptions: notificationOptions,
    NEAR_RATIO: NEAR_RATIO
  };
})(typeof self !== 'undefined' ? self : this);
