/**
 * GET /api/cron/keepalive
 * Daily keepalive ping using role: web_api.
 */

import { getWebDb } from '../_server/lib/db.js';

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized cron request.' });
  }

  try {
    const sql = getWebDb();
    const rows = await sql`
      select slot_date, slot_time, available
      from booking.public_get_slots(current_date, 1)
      limit 1
    `;

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      active: true,
      sample: rows[0] || null
    });
  } catch (err) {
    console.error('[Cron Keepalive] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
