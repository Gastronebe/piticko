/*
 * POST /api/push/unsubscribe
 * Smaže záznam odběru na serveru podle `endpoint`.
 */
'use strict';

const { deleteSubscription, readJsonBody } = require('./_store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const body = await readJsonBody(req);
  const endpoint = body && typeof body.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  try {
    await deleteSubscription(endpoint);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Storage error' });
  }
};
