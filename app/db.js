/*
 * Malá obálka nad IndexedDB bez závislostí.
 * Databáze `piticko`, verze 1: stores `settings`, `entries` (index `date`), `dayGoals`.
 * Klasický skript, sdílený aplikací i service workerem.
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var U = P.U;

  var DB_NAME = 'piticko';
  var DB_VERSION = 1;
  var dbPromise = null;

  var DEFAULT_SETTINGS = {
    key: 'main',
    mode: null,            // 'limit' | 'low'
    theme: 'system',       // 'system' | 'light' | 'dark'
    limitMl: null,         // aktuální limit (režim omezení), zadává uživatel / lékař
    goalMl: null,          // aktuální orientační cíl (režim málo pití), prázdný dokud ho uživatel nezadá
    reminders: {
      enabled: false,
      times: ['09:00', '13:00', '17:00'],
      onlyWhenNearLimit: false
    },
    pushEnabled: false,
    remindersAsked: false,    // návrh připomínek už byl uživateli nabídnut
    pendingUnsubscribe: null, // endpoint, který se nepodařilo smazat ze serveru (offline)
    storagePersisted: null,
    onboardingDone: false
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!g.indexedDB) { reject(new Error('IndexedDB not available')); return; }
      var req = g.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('entries')) {
          var es = db.createObjectStore('entries', { keyPath: 'id' });
          es.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('dayGoals')) db.createObjectStore('dayGoals', { keyPath: 'date' });
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        db.onclose = function () { dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  function promisify(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  /** Spustí fn(stores...) v transakci; výsledek vrátí po dokončení transakce. */
  function run(storeNames, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeNames, mode);
        var stores = storeNames.map(function (n) { return tx.objectStore(n); });
        var result;
        try {
          var r = fn.apply(null, stores);
          if (r && typeof r.onsuccess !== 'undefined') r.onsuccess = function () { result = r.result; };
          else result = r;
        } catch (e) { tx.abort(); reject(e); return; }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('aborted')); };
      });
    });
  }

  // ---------- settings ----------
  function getSettings() {
    return run(['settings'], 'readonly', function (s) { return s.get('main'); }).then(function (v) {
      var out = clone(DEFAULT_SETTINGS);
      if (v) {
        Object.keys(v).forEach(function (k) { out[k] = v[k]; });
        out.reminders = Object.assign(clone(DEFAULT_SETTINGS.reminders), v.reminders || {});
      }
      return out;
    });
  }
  function saveSettings(settings) {
    var v = clone(settings);
    v.key = 'main';
    return run(['settings'], 'readwrite', function (s) { s.put(v); });
  }
  function getMeta(key) {
    return run(['settings'], 'readonly', function (s) { return s.get('meta:' + key); }).then(function (v) { return v ? v.value : null; });
  }
  function setMeta(key, value) {
    return run(['settings'], 'readwrite', function (s) { s.put({ key: 'meta:' + key, value: value }); });
  }

  // ---------- dayGoals ----------
  function goalRecordFromSettings(date, settings) {
    return {
      date: date,
      mode: settings.mode,
      limitMl: settings.mode === 'limit' ? settings.limitMl : null,
      goalMl: settings.mode === 'low' ? settings.goalMl : null
    };
  }
  function getDayGoal(date) {
    return run(['dayGoals'], 'readonly', function (s) { return s.get(date); });
  }
  function setDayGoal(record) {
    return run(['dayGoals'], 'readwrite', function (s) { s.put(record); });
  }
  function getDayGoalsRange(from, to) {
    return run(['dayGoals'], 'readonly', function (s) { return s.getAll(IDBKeyRange.bound(from, to)); });
  }
  /**
   * Limit nebo cíl pro daný den: uložený v dayGoals, jinak aktuální nastavení.
   * Staré dny se nepřepočítávají, protože si hodnotu ukládají při prvním zápisu.
   */
  function resolveGoal(date, goalRecord, settings) {
    var rec = goalRecord && goalRecord.mode === settings.mode ? goalRecord : goalRecordFromSettings(date, settings);
    return settings.mode === 'limit' ? rec.limitMl : rec.goalMl;
  }

  // ---------- entries ----------
  /** Přidá záznam; při prvním zápisu dne uloží aktuální limit/cíl do dayGoals. */
  function addEntry(amountMl, timestamp, settings) {
    var now = Date.now();
    timestamp = timestamp || now;
    var entry = {
      id: U.uuid(),
      date: U.dateKey(timestamp),
      timestamp: timestamp,
      amountMl: amountMl,
      createdAt: now,
      updatedAt: null
    };
    return run(['entries', 'dayGoals'], 'readwrite', function (es, gs) {
      es.add(entry);
      var r = gs.get(entry.date);
      r.onsuccess = function () {
        if (!r.result) gs.put(goalRecordFromSettings(entry.date, settings));
      };
    }).then(function () { return entry; });
  }
  function updateEntry(entry) {
    entry = Object.assign({}, entry, { updatedAt: Date.now() });
    entry.date = U.dateKey(entry.timestamp);
    return run(['entries'], 'readwrite', function (s) { s.put(entry); }).then(function () { return entry; });
  }
  /** Fyzické smazání. Vrací smazaný záznam (pro funkci „Zpět“). */
  function deleteEntry(id) {
    var found;
    return run(['entries'], 'readwrite', function (s) {
      var r = s.get(id);
      r.onsuccess = function () { found = r.result; s.delete(id); };
    }).then(function () { return found; });
  }
  function restoreEntry(entry) {
    return run(['entries'], 'readwrite', function (s) { s.put(entry); });
  }
  function sortByTime(list) { return list.sort(function (a, b) { return a.timestamp - b.timestamp; }); }
  function getEntriesByDate(date) {
    return run(['entries'], 'readonly', function (s) { return s.index('date').getAll(date); }).then(sortByTime);
  }
  function getEntriesRange(from, to) {
    return run(['entries'], 'readonly', function (s) {
      return s.index('date').getAll(IDBKeyRange.bound(from, to));
    }).then(sortByTime);
  }
  function getAllEntries() {
    return run(['entries'], 'readonly', function (s) { return s.getAll(); }).then(sortByTime);
  }
  function getAllDayGoals() {
    return run(['dayGoals'], 'readonly', function (s) { return s.getAll(); });
  }

  /** Smaže záznamy a denní limity (při změně režimu). Nastavení zůstává. */
  function clearRecords() {
    return run(['entries', 'dayGoals'], 'readwrite', function (es, gs) { es.clear(); gs.clear(); });
  }
  /** Smaže celou databázi. */
  function wipeAll() {
    return open().then(function (db) {
      db.close();
      dbPromise = null;
      return new Promise(function (resolve, reject) {
        var r = g.indexedDB.deleteDatabase(DB_NAME);
        r.onsuccess = function () { resolve(); };
        r.onerror = function () { reject(r.error); };
        r.onblocked = function () { resolve(); };
      });
    });
  }

  /** Součty a limity pro rozsah dnů (včetně). */
  function rangeData(from, to, settings) {
    return Promise.all([getEntriesRange(from, to), getDayGoalsRange(from, to)]).then(function (res) {
      var entries = res[0];
      var goals = {};
      res[1].forEach(function (gr) { goals[gr.date] = gr; });
      var totals = {};
      entries.forEach(function (e) {
        var t = totals[e.date] || (totals[e.date] = { total: 0, count: 0 });
        t.total += e.amountMl;
        t.count += 1;
      });
      return U.daysBetween(from, to).map(function (date) {
        var t = totals[date] || { total: 0, count: 0 };
        return { date: date, total: t.total, count: t.count, goal: resolveGoal(date, goals[date], settings) };
      });
    });
  }

  P.DB = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    open: open,
    getSettings: getSettings, saveSettings: saveSettings,
    getMeta: getMeta, setMeta: setMeta,
    getDayGoal: getDayGoal, setDayGoal: setDayGoal, getDayGoalsRange: getDayGoalsRange,
    goalRecordFromSettings: goalRecordFromSettings, resolveGoal: resolveGoal,
    addEntry: addEntry, updateEntry: updateEntry, deleteEntry: deleteEntry, restoreEntry: restoreEntry,
    getEntriesByDate: getEntriesByDate, getEntriesRange: getEntriesRange, getAllEntries: getAllEntries,
    getAllDayGoals: getAllDayGoals, clearRecords: clearRecords, wipeAll: wipeAll, rangeData: rangeData
  };
})(typeof self !== 'undefined' ? self : this);
