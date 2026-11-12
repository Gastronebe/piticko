/*
 * POST /api/push/send
 * Interní endpoint chráněný tajným klíčem (PUSH_API_SECRET nebo CRON_SECRET).
 * Odešle prázdnou Web Push zprávu (bez těla – obsah připraví service worker v zařízení
 * z lokálních dat v IndexedDB). Neplatné odběry (404/410) se automaticky smažou.
 *
 * Používá vestavěné `node:crypto` (ES256 VAPID podle RFC 8292) bez externích balíčků.
 */
'use strict';

const crypto = require('node:crypto');
const { listSubscriptions, deleteSubscription } = require('./_store');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlToBuf(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from((str + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function buildVapidJwt(audience, subject, publicKeyB64, privateKeyB64) {
  const pub = b64urlToBuf(publicKeyB64); // 65 B nekomprimovaný bod 0x04 || X (32 B) || Y (32 B)
  const priv = b64urlToBuf(privateKeyB64); // 32 B
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(pub.subarray(1, 33)),
    y: b64url(pub.subarray(33, 65)),
    d: b64url(priv)
  };
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = b64url(JSON.stringify({ aud: audience, exp, sub: subject }));
  const signingInput = header + '.' + payload;
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return signingInput + '.' + b64url(sig);
}

function authorized(req) {
  const secret = process.env.PUSH_API_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-push-secret'] || '');
  const a = Buffer.from(String(token));
  const b = Buffer.from(String(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sendEmptyPush(sub, publicKey, privateKey, subject) {
  const u = new URL(sub.endpoint);
  const jwt = buildVapidJwt(u.origin, subject, publicKey, privateKey);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '3600',
      Urgency: 'normal',
      'Content-Length': '0',
      Authorization: 'vapid t=' + jwt + ', k=' + publicKey
    }
  });
  if (res.status === 404 || res.status === 410) {
    await deleteSubscription(sub.endpoint);
    return 'gone';
  }
  return res.ok ? 'sent' : 'failed';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:soukromi@piticko.online';
  if (!publicKey || !privateKey) {
    return res.status(503).json({ error: 'VAPID keys not configured' });
  }

  const subs = await listSubscriptions();
  let sent = 0, gone = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const r = await sendEmptyPush(s, publicKey, privateKey, subject);
      if (r === 'sent') sent++;
      else if (r === 'gone') gone++;
      else failed++;
    } catch {
      failed++;
    }
  }));
  return res.status(200).json({ sent, gone, failed });
};
