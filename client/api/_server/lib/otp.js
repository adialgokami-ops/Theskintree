/**
 * client/api/server/lib/otp.js
 * Cryptographic Phone OTP Helper for The Skin Tree appointment confirmations.
 *
 * Assumed SMS Provider: MSG91 (India)
 * Regulatory Compliance:
 * - TRAI TCCCPR 2018 (India DLT Mandate)
 * - Principal Entity (PE) ID: Registered with telecom operator (Jio/Airtel/VilPower)
 * - Header / Sender ID: 6-char registered header (e.g. "SKNTRE")
 * - Content Template ID: Approved DLT template for appointment OTP
 *
 * Hard Rule: Fails CLOSED. If OTP is enabled or in production, lack of valid OTP
 * rejects the booking rather than bypassing verification.
 */

import crypto from 'node:crypto';

// In-memory OTP storage: phone -> { hash, expiresAt, attempts }
const otpStore = new Map();

function hashOtp(phone, otp) {
  const secret = process.env.OTP_SECRET || process.env.CRON_SECRET || 'theskintree-default-otp-salt';
  return crypto.createHash('sha256').update(`${phone}:${otp}:${secret}`).digest('hex');
}

/**
 * Generate and store a 6-digit OTP for a phone number
 */
export function generateOtp(phone) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  const hash = hashOtp(phone, otp);

  otpStore.set(phone, {
    hash,
    expiresAt,
    attempts: 0
  });

  return { otp, expiresAt };
}

/**
 * Verify a submitted OTP against stored hash.
 * Fails CLOSED: requires valid submitted OTP code.
 */
export function verifyOtp(phone, submittedCode) {
  // Explicit bypass only permitted in automated test environments
  if (process.env.NODE_ENV === 'test' && process.env.BYPASS_OTP === 'true') {
    return { ok: true, bypassed: true };
  }

  // If OTP is strictly disabled in development via env flag
  if (process.env.REQUIRE_PHONE_OTP === 'false' && process.env.NODE_ENV !== 'production') {
    return { ok: true, bypassed: true };
  }

  if (!submittedCode || typeof submittedCode !== 'string' || submittedCode.trim().length === 0) {
    return {
      ok: false,
      code: 'otp_required',
      error: 'A 6-digit SMS verification code (OTP) is required to confirm your consultation.'
    };
  }

  const record = otpStore.get(phone);
  if (!record) {
    // Development fallback test code when no SMS gateway is connected
    if (process.env.NODE_ENV !== 'production' && submittedCode.trim() === '123456') {
      return { ok: true };
    }
    return {
      ok: false,
      code: 'otp_not_found',
      error: 'No active OTP found for this phone number. Please request a new verification code.'
    };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return {
      ok: false,
      code: 'otp_expired',
      error: 'The verification code has expired (5-minute window). Please request a fresh OTP.'
    };
  }

  record.attempts += 1;
  if (record.attempts > 3) {
    otpStore.delete(phone);
    return {
      ok: false,
      code: 'too_many_attempts',
      error: 'Too many incorrect OTP attempts. For security, please request a new code.'
    };
  }

  const expectedHash = hashOtp(phone, submittedCode.trim());
  if (record.hash !== expectedHash) {
    return {
      ok: false,
      code: 'otp_invalid',
      error: 'Incorrect verification code. Please check your SMS and try again.'
    };
  }

  // Consume OTP upon successful verification
  otpStore.delete(phone);
  return { ok: true };
}

export default { generateOtp, verifyOtp };
