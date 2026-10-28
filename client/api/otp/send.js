/**
 * POST /api/otp/send
 * Public phone OTP generation endpoint for appointment verification.
 *
 * Security & Regulatory Controls:
 * 1. IP Rate Limiting (max 5 requests per 10 minutes).
 * 2. Per-phone Rate Limiting (max 3 requests per hour).
 * 3. TRAI DLT Compliance check: fails closed in production if SMS provider is not configured.
 * 4. Generates cryptographic SHA-256 OTP record with 5-minute expiry.
 */

import { generateOtp } from '../_server/lib/otp.js';
import { checkRateLimit } from '../_server/lib/ratelimit.js';
import { normalisePhone, validatePhone } from '@theskintree/shared';

export default async function handler(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // 1. IP Rate Limiting
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous';
  const ipRateLimit = await checkRateLimit(`otp:ip:${clientIp}`, { limit: 5, windowSeconds: 600 });
  if (!ipRateLimit.ok) {
    return res.status(429).json({
      ok: false,
      code: 'rate_limited',
      error: 'Too many OTP requests. Please wait a few minutes before requesting another code.'
    });
  }

  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ ok: false, code: 'phone_required', error: 'Phone number is required.' });
  }

  const normalisedPhone = normalisePhone(phone);
  if (!validatePhone(normalisedPhone)) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_phone',
      error: 'Please enter a valid 10-digit Indian mobile number (+91).'
    });
  }

  // 2. Per-Phone Rate Limiting (Max 3 OTP requests per hour)
  const phoneRateLimit = await checkRateLimit(`otp:phone:${normalisedPhone}`, { limit: 3, windowSeconds: 3600 });
  if (!phoneRateLimit.ok) {
    return res.status(429).json({
      ok: false,
      code: 'too_many_requests',
      error: 'Too many verification attempts for this number. Please try again after 1 hour.'
    });
  }

  // 3. Check SMS Gateway Availability
  const hasSmsGateway = Boolean(process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY);
  if (!hasSmsGateway && process.env.NODE_ENV === 'production') {
    // Fail CLOSED in production if SMS infrastructure is not yet provisioned
    return res.status(503).json({
      ok: false,
      code: 'sms_service_unavailable',
      error: 'SMS verification is temporarily undergoing telecom gateway registration. Please reach out on WhatsApp at +91 98200 12345.'
    });
  }

  // 4. Generate Cryptographic OTP
  const { otp, expiresAt } = generateOtp(normalisedPhone);

  // In non-production, log code for verification testing
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP] Generated verification code for ${normalisedPhone.slice(0, 7)}*** (expires in 5m)`);
  }

  return res.status(200).json({
    ok: true,
    message: 'Verification code generated successfully.',
    expiresAt
  });
}
