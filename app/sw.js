/*
 * Pitíčko – service worker (rozsah /app/).
 * - Offline provoz: statické soubory ve verzované cache.
 * - Nové nasazení: zvyšte CACHE_VERSION, stará cache se po aktivaci smaže.
 * - Připomínky: Periodic Background Sync (kde je podporován) a Web Push.
 *   Obsah upozornění se skládá z lokálních dat v IndexedDB, server nic nevidí.
 */
'use strict';

var CACHE_VERSION = 'piticko-v4';
var ASSETS = [
  '/app/',
  '/app/app.css',
  '/app/theme-init.js',
  '/app/strings.cs.js',
  '/app/i18n.js',
  '/app/util.js',
  '/app/db.js',
  '/app/reminders.js',
  '/app/notify.js',
  '/app/charts.js',
  '/app/export.js',
  '/app/install.js',
  '/app/app.js',
  '/app/manifest.json',
  '/app/fonts/fraunces-800-latin-ext.woff2',
  '/app/fonts/fraunces-800-latin.woff2',
  '/app/fonts/work-sans-400-latin-ext.woff2',
  '/app/fonts/work-sans-400-latin.woff2',
  '/app/fonts/work-sans-600-latin-ext.woff2',
  '/app/fonts/work-sans-600-latin.woff2',
  '/app/icons/favicon.svg',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/maskable-512.png',
  '/app/icons/apple-touch-icon.png',
  '/app/icons/badge-96.png',
  '/app/img/ios-step1.svg',
  '/app/img/ios-step2.svg',
  '/app/img/ios-step3.svg'
];

importScripts('/app/strings.cs.js', '/app/i18n.js', '/app/util.js', '/app/db.js', '/app/reminders.js');

/**
 * Odstraní příznak `redirected` z Response.
 * Prohlížeče odmítají odpověď s `redirected === true` u navigačních požadavků,
 * jejichž redirect mode není "follow".
 */
function cleanResponse(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (body) {
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers
    });
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return fetch(new Request(url, { cache: 'reload', redirect: 'follow' }))
          .then(cleanResponse)
          .then(function (res) {
            if (res.ok) return cache.put(url, res);
          });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('piticko-') === 0 && k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  // Navigace v aplikaci: vrátit shell z cache (vždy bez příznaku redirected).
  if (req.mode === 'navigate' && url.pathname.indexOf('/app') === 0) {
    event.respondWith(
      caches.match('/app/').then(function (cached) {
        if (cached) return cleanResponse(cached);
        return fetch(req).then(cleanResponse);
      })
    );
    return;
  }

  // Statické soubory: nejdřív cache, jinak síť (a uložit čistou kopii).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cleanResponse(cached);
      return fetch(req).then(cleanResponse).then(function (res) {
        if (res && res.ok && url.pathname.indexOf('/app/') === 0) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});

function show(title, options) {
  return self.registration.showNotification(title, options);
}

self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'piticko-reminders') {
    event.waitUntil(P.Reminders.runDue(show));
  }
});

self.addEventListener('push', function (event) {
  event.waitUntil(
    P.DB.getSettings().then(function (s) {
      return P.Reminders.buildContent(s, true).then(function (c) {
        return P.DB.setMeta('reminderState', { lastShownAt: Date.now() }).then(function () {
          return show(c.title, P.Reminders.notificationOptions(c.body));
        });
      });
    }).catch(function () {
      return show(P.t('notify.title'), P.Reminders.notificationOptions(P.t('notify.generic1')));
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/app/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (new URL(c.url).pathname.indexOf('/app/') === 0 && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  var old = event.oldSubscription;
  event.waitUntil(
    fetch('/api/push/vapid-public-key').then(function (r) { return r.json(); }).then(function (data) {
      var raw = atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - data.publicKey.length % 4) % 4));
      var key = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
      return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }).then(function (sub) {
      var j = sub.toJSON();
      var jobs = [fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } })
      })];
      if (old) {
        jobs.push(fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: old.endpoint })
        }));
      }
      return Promise.all(jobs);
    }).catch(function () { /* offline – zkusí se příště */ })
  );
});
