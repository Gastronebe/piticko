/*
 * POST /api/push/subscribe
 * Uloží pouze { endpoint, keys: { p256dh, auth } }.
 * Žádný identifikátor uživatele ani zdravotní data se nepřijímají ani neukládají.
 */
'use strict';

const { putSubscription, readJsonBody } = require('./_store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  try {
    const ok = await putSubscription(body);
    if (!ok) return res.status(400).json({ error: 'Invalid subscription' });
    return res.status(201).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Storage error' });
  }
};
