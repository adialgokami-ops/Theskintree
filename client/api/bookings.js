/**
 * POST /api/bookings
 * Public appointment creation endpoint.
 * Hard Rule 3: Single source of truth in SQL (create_booking RPC).
 * Hard Rule 6: Notifications must never fail or undo a booking.
 * Hard Rule 7: Never show confirmed unless database insert succeeded.
 * Hard Rule 8: Abuse protection (IP & Phone rate limiting, Turnstile, OTP).
 */

import { createNewBooking, fetchSlotsRange } from './_server/lib/bookings.js';
import { validateBookingInput, ERROR_MESSAGES } from './_server/lib/validate.js';
import { sendBookingConfirmationToPatient, sendBookingNotificationToClinic } from './_server/lib/notify.js';
import { checkRateLimit } from './_server/lib/ratelimit.js';
import { verifyTurnstileToken } from './_server/lib/turnstile.js';
import { verifyOtp } from './_server/lib/otp.js';
import { resetWebDb } from './_server/lib/db.js';

// Server-side canonical consent constants
export const SERVER_CONSENT_VERSION = '2026.1-dpdp';
// Derived as SHA-256 of canonical displayed consent text:
// "I consent to The Skin Tree processing my contact details for appointment scheduling in accordance with the Privacy Notice (v2026.1-dpdp)."
export const SERVER_CONSENT_HASH = '6f242e4212e81cfb7a2e1bbeee7bd7aecb4a7711862edb3214ecd0487fc348d0';

export default async function handler(req, res) {
  // Always enforce Referrer-Policy: no-referrer to prevent token leakage
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. IP Rate Limiting Check (Max 15 requests/minute per IP)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous';
  const ipRateLimit = await checkRateLimit(`booking:ip:${clientIp}`, { limit: 15, windowSeconds: 60 });
  if (!ipRateLimit.ok) {
    if (ipRateLimit.failClosed) {
      return res.status(503).json({
        ok: false,
        code: 'service_unavailable',
        error: 'Appointment booking is temporarily unavailable due to security configuration. Please contact the clinic directly.'
      });
    }
    return res.status(429).json({
      ok: false,
      code: 'rate_limited',
      error: ERROR_MESSAGES.rate_limited
    });
  }

  const body = req.body || {};

  // 2. Anti-Spam Honeypot Verification
  if (body.website) {
    // Hidden honeypot field was filled by an automated bot
    return res.status(400).json({ ok: false, error: 'Invalid submission detected.' });
  }

  // 3. Bot Protection (Cloudflare Turnstile)
  const turnstileResult = await verifyTurnstileToken(body.turnstileToken, clientIp);
  if (!turnstileResult.ok) {
    return res.status(400).json({
      ok: false,
      code: 'captcha_failed',
      error: turnstileResult.error || 'Security verification failed.'
    });
  }

  // 4. Input Validation
  const validation = validateBookingInput({
    name: body.name,
    phone: body.phone,
    email: body.email,
    treatment: body.treatment,
    date: body.date,
    time: body.time,
    notes: body.notes
  });

  if (!validation.valid) {
    return res.status(400).json({
      ok: false,
      code: 'validation_failed',
      errors: validation.errors
    });
  }

  // 5. Per-Phone Rate Limiting (Max 3 booking requests per day per phone)
  const phoneRateLimit = await checkRateLimit(`booking:phone:${validation.normalisedPhone}`, { limit: 3, windowSeconds: 86400 });
  if (!phoneRateLimit.ok) {
    if (phoneRateLimit.failClosed) {
      return res.status(503).json({
        ok: false,
        code: 'service_unavailable',
        error: 'Appointment booking is temporarily unavailable due to security configuration. Please contact the clinic directly.'
      });
    }
    return res.status(429).json({
      ok: false,
      code: 'too_many_active',
      error: 'Daily booking limit reached for this phone number (max 3 per day). Please wait or contact the clinic directly.'
    });
  }

  // 6. Phone OTP Verification Step (if required)
  const otpResult = verifyOtp(validation.normalisedPhone, body.otpCode);
  if (!otpResult.ok) {
    return res.status(400).json({
      ok: false,
      code: 'otp_failed',
      error: otpResult.error
    });
  }

  if (!body.consent) {
    return res.status(400).json({
      ok: false,
      code: 'consent_required',
      error: ERROR_MESSAGES.consent_required
    });
  }

  // Enforce server-side consent version & hash verification
  if (body.consentVersion !== SERVER_CONSENT_VERSION || body.consentTextHash !== SERVER_CONSENT_HASH) {
    return res.status(400).json({
      ok: false,
      code: 'consent_version_mismatch',
      error: 'Consent terms version mismatch. Please reload the booking form to view updated terms.'
    });
  }

  try {
    // 7. Call Database RPC (atomic isolation & locking)
    const result = await createNewBooking({
      name: body.name.trim(),
      phone: validation.normalisedPhone,
      email: body.email?.trim() || null,
      treatment: body.treatment.trim(),
      date: body.date,
      time: body.time,
      notes: body.notes?.trim() || null,
      consent: true,
      idempotencyKey: body.idempotencyKey || null,
      source: 'website_form'
    });

    if (!result.ok) {
      const code = result.code || 'generic';
      const friendlyMessage = ERROR_MESSAGES[code] || ERROR_MESSAGES.generic;

      // Handle slot conflict (409) with fresh slots for that date
      if (code === 'slot_taken') {
        let freshSlots = [];
        try {
          const freshData = await fetchSlotsRange(body.date, 1);
          freshSlots = freshData.days?.[0]?.slots || [];
        } catch (_) {}

        return res.status(409).json({
          ok: false,
          code,
          error: friendlyMessage,
          freshSlots
        });
      }

      // Business logic rejections
      const statusCode = code === 'consent_required' ? 400 : 422;
      return res.status(statusCode).json({
        ok: false,
        code,
        error: friendlyMessage
      });
    }

    // 8. Fire-and-forget notifications (Hard Rule 6: Never fail booking on email error)
    Promise.all([
      sendBookingConfirmationToPatient({
        patientEmail: body.email,
        patientName: body.name,
        treatment: body.treatment,
        date: body.date,
        time: body.time,
        manageToken: result.manage_token
      }).catch(err => console.error('[Notify] Patient email failed:', err.message)),

      sendBookingNotificationToClinic({
        patientName: body.name,
        phone: validation.normalisedPhone,
        treatment: body.treatment,
        date: body.date,
        time: body.time,
        notes: body.notes,
        source: 'website_form'
      }).catch(err => console.error('[Notify] Clinic email failed:', err.message))
    ]);

    // 9. Hard Rule 7: Return success only after DB insert
    return res.status(200).json({
      ok: true,
      id: result.id,
      manageToken: result.manage_token,
      duplicate: result.duplicate || false
    });
  } catch (err) {
    console.error('[API Bookings] Error creating booking:', err.message);
    resetWebDb();
    return res.status(500).json({
      ok: false,
      code: 'generic',
      error: ERROR_MESSAGES.generic
    });
  }
}
