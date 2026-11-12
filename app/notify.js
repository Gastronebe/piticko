/*
 * Upozornění na straně aplikace: povolení, lokální plánování a Web Push odběr.
 *
 * Fáze 1 (MVP):
 *  - Připomínky se plánují lokálně, když je aplikace otevřená (časovače),
 *    a přes Periodic Background Sync tam, kde ho prohlížeč podporuje (Chrome, nainstalovaná PWA).
 *  - Pokud je na serveru nastaven VAPID klíč, zařízení se přihlásí k odběru Web Push.
 *    Server ukládá jen endpoint a klíče, obsah zprávy připraví service worker z lokálních dat.
 * Fáze 2: server může posílat prázdné „budíčky“ přes /api/push/send.
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var U = P.U, DB = P.DB, R = P.Reminders;

  var timers = [];

  function supported() {
    return 'Notification' in g && 'serviceWorker' in navigator;
  }
  function pushSupported() {
    return supported() && 'PushManager' in g;
  }
  function permission() {
    return supported() ? Notification.permission : 'unsupported';
  }
  /** iPhone v Safari mimo plochu – upozornění tam nefungují. */
  function iosNeedsInstall() {
    return U.isIOS() && !U.isStandalone();
  }

  function requestPermission() {
    if (!supported()) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return new Promise(function (resolve) {
      var p = Notification.requestPermission(resolve);
      if (p && p.then) p.then(resolve);
    });
  }

  function show(title, options) {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, options); });
  }

  /** Naplánuje časovače pro dnešní zbývající časy (jen dokud je aplikace otevřená). */
  function scheduleInApp(settings) {
    timers.forEach(clearTimeout);
    timers = [];
    if (!settings.reminders.enabled || permission() !== 'granted') return;
    var now = Date.now();
    var today = U.todayKey();
    settings.reminders.times.forEach(function (hhmm) {
      if (!U.isValidTime(hhmm)) return;
      var delay = U.timestampFor(today, hhmm) - now;
      if (delay > 0 && delay < 24 * 3600 * 1000) {
        timers.push(setTimeout(function () { R.runDue(show); }, delay + 500));
      }
    });
    // Připomínka, která právě nastala (např. aplikace otevřená chvíli po čase připomínky), se nezobrazuje,
    // aby uživatele nerušila v okamžiku, kdy aplikaci používá.
  }

  function registerPeriodicSync() {
    return navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return false;
      var q = navigator.permissions && navigator.permissions.query
        ? navigator.permissions.query({ name: 'periodic-background-sync' }).catch(function () { return { state: 'denied' }; })
        : Promise.resolve({ state: 'denied' });
      return q.then(function (st) {
        if (st.state !== 'granted') return false;
        return reg.periodicSync.register('piticko-reminders', { minInterval: 60 * 60 * 1000 }).then(function () { return true; });
      });
    }).catch(function () { return false; });
  }
  function unregisterPeriodicSync() {
    return navigator.serviceWorker.ready.then(function (reg) {
      if (reg.periodicSync) return reg.periodicSync.unregister('piticko-reminders');
    }).catch(function () {});
  }

  function b64urlToUint8(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /** Přihlášení k Web Push. Vrací true/false. Selhání (offline, chybí VAPID) nevadí – fungují lokální připomínky. */
  function subscribePush() {
    if (!pushSupported() || permission() !== 'granted') return Promise.resolve(false);
    return fetch('/api/push/vapid-public-key', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no key'); return r.json(); })
      .then(function (data) {
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.getSubscription().then(function (existing) {
            return existing || reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: b64urlToUint8(data.publicKey)
            });
          });
        });
      })
      .then(function (sub) {
        var j = sub.toJSON();
        // Odesílá se jen endpoint a klíče. Žádná zdravotní data ani identifikátor uživatele.
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } })
        }).then(function (r) { return r.ok; });
      })
      .catch(function () { return false; });
  }

  function deleteOnServer(endpoint) {
    return fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: endpoint })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /**
   * Zruší odběr v prohlížeči i na serveru. Pokud je zařízení offline,
   * endpoint se uloží a smazání na serveru se zopakuje při dalším spuštění.
   */
  function unsubscribePush(settings) {
    if (!pushSupported()) return Promise.resolve(settings);
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        if (!sub) return settings;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().catch(function () {}).then(function () {
          return deleteOnServer(endpoint);
        }).then(function (ok) {
          settings.pendingUnsubscribe = ok ? null : endpoint;
          return settings;
        });
      })
      .catch(function () { return settings; })
      .then(function (s) { s.pushEnabled = false; return s; });
  }

  function retryPendingUnsubscribe(settings) {
    if (!settings.pendingUnsubscribe) return Promise.resolve(false);
    return deleteOnServer(settings.pendingUnsubscribe).then(function (ok) {
      if (!ok) return false;
      settings.pendingUnsubscribe = null;
      return DB.saveSettings(settings).then(function () { return true; });
    });
  }

  /** Zapne připomínky (po kliknutí na „Ano, chci“). Vrací výsledek: 'ok' | 'denied' | 'unsupported' | 'ios-install'. */
  function enable(settings, times) {
    if (iosNeedsInstall()) return Promise.resolve('ios-install');
    if (!supported()) return Promise.resolve('unsupported');
    return requestPermission().then(function (perm) {
      if (perm !== 'granted') return perm === 'unsupported' ? 'unsupported' : 'denied';
      settings.reminders.enabled = true;
      if (times) settings.reminders.times = times;
      return DB.setMeta('reminderState', { lastShownAt: Date.now() })
        .then(function () { return subscribePush(); })
        .then(function (pushOk) {
          settings.pushEnabled = pushOk;
          return DB.saveSettings(settings);
        })
        .then(function () {
          registerPeriodicSync();
          scheduleInApp(settings);
          return 'ok';
        });
    });
  }

  function disable(settings) {
    settings.reminders.enabled = false;
    timers.forEach(clearTimeout);
    timers = [];
    unregisterPeriodicSync();
    return unsubscribePush(settings).then(function (s) { return DB.saveSettings(s).then(function () { return s; }); });
  }

  P.Notify = {
    supported: supported, pushSupported: pushSupported, permission: permission,
    iosNeedsInstall: iosNeedsInstall, enable: enable, disable: disable,
    scheduleInApp: scheduleInApp, registerPeriodicSync: registerPeriodicSync,
    unsubscribePush: unsubscribePush, retryPendingUnsubscribe: retryPendingUnsubscribe
  };
})(self);
