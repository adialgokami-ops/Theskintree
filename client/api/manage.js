/**
 * /api/manage
 * Patient appointment self-management (view, cancel, reschedule).
 * Uses role: web_api via booking.public_manage_* functions.
 * Hard Rule 3: Single source of truth in SQL.
 * Hard Rule 2: Never return phone or email.
 * Hard Rule 8: Referrer-Policy: no-referrer, rate limited, uniform errors.
 */

import { getBookingByToken, cancelBooking, rescheduleBooking } from './_server/lib/bookings.js';
import { ERROR_MESSAGES, validateDate, validateTime } from './_server/lib/validate.js';
import { checkRateLimit } from './_server/lib/ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous';
  const rateLimit = await checkRateLimit(`manage:${clientIp}`, { limit: 30, windowSeconds: 60 });
  if (!rateLimit.ok) {
    return res.status(429).json({ error: ERROR_MESSAGES.rate_limited });
  }

  // GET: Fetch booking by token
  if (req.method === 'GET') {
    const token = req.query.token;
    if (!token || typeof token !== 'string' || token.length < 16) {
      return res.status(400).json({ error: 'Valid management token is required.' });
    }

    try {
      const booking = await getBookingByToken(token);
      if (!booking) {
        return res.status(404).json({ error: 'Appointment not found or link has expired.' });
      }

      // Returns ONLY safe fields (firstName, treatment, date, time, status)
      return res.status(200).json({
        treatment: booking.treatment,
        date: booking.date,
        time: booking.time,
        status: booking.status,
        firstName: booking.firstName
      });
    } catch (err) {
      console.error('[API Manage] Error fetching booking:', err.message);
      return res.status(500).json({ error: 'Unable to retrieve appointment details.' });
    }
  }

  // POST: Cancel or Reschedule
  if (req.method === 'POST') {
    const { token, action, date, time } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 16) {
      return res.status(400).json({ error: 'Valid management token is required.' });
    }

    try {
      if (action === 'cancel') {
        const result = await cancelBooking({ manageToken: token });
        if (!result.ok) {
          const code = result.code || 'generic';
          return res.status(422).json({
            ok: false,
            code,
            error: ERROR_MESSAGES[code] || ERROR_MESSAGES.generic
          });
        }

        return res.status(200).json({ ok: true, status: 'cancelled' });
      }

      if (action === 'reschedule') {
        if (!validateDate(date) || !validateTime(time)) {
          return res.status(400).json({ error: 'Valid date and time are required for rescheduling.' });
        }

        const result = await rescheduleBooking({
          manageToken: token,
          date,
          time
        });

        if (!result.ok) {
          const code = result.code || 'generic';
          const statusCode = code === 'slot_taken' ? 409 : 422;
          return res.status(statusCode).json({
            ok: false,
            code,
            error: ERROR_MESSAGES[code] || ERROR_MESSAGES.generic
          });
        }

        return res.status(200).json({ ok: true, date, time });
      }

      return res.status(400).json({ error: 'Invalid action. Allowed: "cancel" or "reschedule".' });
    } catch (err) {
      console.error('[API Manage] Error modifying booking:', err.message);
      return res.status(500).json({ error: 'Failed to process request. Please contact the clinic.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
