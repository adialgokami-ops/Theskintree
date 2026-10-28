/**
 * Vercel Serverless Function: /api/cron/keepalive
 * Keeps database connections and pooler warm.
 * Protected by Bearer CRON_SECRET.
 */

import { getDbFor } from '../../server/lib/db.js';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret.' });
  }

  const result = {
    timestamp: new Date().toISOString(),
    status: 'unknown'
  };

  try {
    const sql = getDbFor({ role: 'admin' }).booking();
    const [row] = await sql`select count(*) as count from booking.clinic_settings`;
    result.status = 'healthy';
    result.clinicSettings = row?.count || 1;
  } catch (err) {
    result.status = `error: ${err.message}`;
  }

  return res.status(200).json({ ok: true, ...result });
}
