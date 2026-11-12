/*
 * Úložiště Web Push odběrů na serveru (store `pushSubscriptions`).
 * Ukládá výhradně { endpoint, keys: { p256dh, auth } } pod klíčem odvozeným z SHA-256 hashe endpointu.
 * Neukládá žádné identifikátory uživatelů, IP adresy, časy ani zdravotní data.
 *
 * V produkci na Vercelu používá Vercel KV / Upstash Redis přes REST rozhraní
 * (proměnné KV_REST_API_URL a KV_REST_API_TOKEN) bez externích závislostí.
 * Pokud proměnné nejsou nastavené (lokální vývoj / Fáze 1), použije dočasný soubor v /tmp.
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SET_KEY = 'piticko:pushSubscriptions';
const TMP_FILE = path.join('/tmp', 'piticko-push-subscriptions.json');

function idForEndpoint(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex');
}

function sanitizeSubscription(input) {
  if (!input || typeof input !== 'object') return null;
  const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
  const keys = input.keys && typeof input.keys === 'object' ? input.keys : null;
  const p256dh = keys && typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = keys && typeof keys.auth === 'string' ? keys.auth.trim() : '';
  if (!endpoint || !p256dh || !auth) return null;
  let u;
  try { u = new URL(endpoint); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (endpoint.length > 2048 || p256dh.length > 256 || auth.length > 128) return null;
  // Uloží se výhradně endpoint a klíče.
  return { endpoint, keys: { p256dh, auth } };
}

function hasKv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCmd(args) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error('KV error ' + res.status);
  const data = await res.json();
  return data.result;
}

function readLocalMap() {
  try {
    return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeLocalMap(map) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(map), { mode: 0o600 });
  } catch {
    /* ignore */
  }
}

async function putSubscription(raw) {
  const sub = sanitizeSubscription(raw);
  if (!sub) return false;
  const id = idForEndpoint(sub.endpoint);
  const value = JSON.stringify(sub);
  if (hasKv()) {
    await kvCmd(['HSET', SET_KEY, id, value]);
  } else {
    const map = readLocalMap();
    map[id] = sub;
    writeLocalMap(map);
  }
  return true;
}

async function deleteSubscription(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return false;
  const id = idForEndpoint(endpoint.trim());
  if (hasKv()) {
    await kvCmd(['HDEL', SET_KEY, id]);
  } else {
    const map = readLocalMap();
    delete map[id];
    writeLocalMap(map);
  }
  return true;
}

async function listSubscriptions() {
  if (hasKv()) {
    const all = await kvCmd(['HVALS', SET_KEY]);
    if (!Array.isArray(all)) return [];
    return all.map((s) => { try { return sanitizeSubscription(JSON.parse(s)); } catch { return null; } }).filter(Boolean);
  }
  const map = readLocalMap();
  return Object.values(map).map(sanitizeSubscription).filter(Boolean);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 16384) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = {
  sanitizeSubscription,
  putSubscription,
  deleteSubscription,
  listSubscriptions,
  readJsonBody
};
