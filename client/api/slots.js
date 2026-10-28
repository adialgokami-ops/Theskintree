/**
 * GET /api/slots?from=YYYY-MM-DD&days=14
 * Public endpoint for slot availability.
 * Uses role: web_api via PostgreSQL function booking.public_get_slots.
 * Hard Rule 3: Single source of truth is SQL function booking.public_get_slots.
 * Hard Rule 4: All date/time logic in database using Asia/Kolkata.
 */

import { fetchSlotsRange } from './_server/lib/bookings.js';
import { checkRateLimit } from './_server/lib/ratelimit.js';
import { getWebDb, resetWebDb } from './_server/lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Diagnostic route for DB connection & EXPLAIN ANALYZE latency analysis
  if (req.query.diag === '1') {
    try {
      const sql = getWebDb();
      const t0 = Date.now();
      await sql`SELECT 1`;
      const select1_ms = Date.now() - t0;

      const t1 = Date.now();
      const explainRows = await sql`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT * FROM booking.public_get_slots(current_date, 14)
      `;
      const explain_query_ms = Date.now() - t1;

      return res.status(200).json({
        ok: true,
        region: process.env.VERCEL_REGION || 'local',
        select1_ms,
        explain_query_ms,
        plan: explainRows.map((r) => r['QUERY PLAN'])
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // Rate Limiting: Max 60 requests/minute per IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous';
  const rateLimit = await checkRateLimit(`slots:${clientIp}`, { limit: 60, windowSeconds: 60 });
  if (!rateLimit.ok) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment before refreshing slots.' });
  }

  try {
    let fromDate = req.query.from || req.query.date;
    const days = req.query.date ? 1 : (parseInt(req.query.days, 10) || 14);

    if (!fromDate) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      fromDate = formatter.format(now);
    }

    const result = await fetchSlotsRange(fromDate, Math.min(days, 30));

    // Hard Rule 3: Cache-Control header
    res.setHeader('Cache-Control', 'public, s-maxage=3, stale-while-revalidate=5');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[API Slots] Error fetching slots:', err.message);
    resetWebDb();
    return res.status(503).json({
      ok: false,
      error: 'Failed to retrieve slot availability. Please try again.'
    });
  }
}
