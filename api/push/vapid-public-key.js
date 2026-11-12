/*
 * GET /api/push/vapid-public-key
 * Vrátí veřejný VAPID klíč z proměnné prostředí VAPID_PUBLIC_KEY.
 */
'use strict';

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({ error: 'VAPID key not configured' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ publicKey });
};
