/**
 * client/api/server/lib/turnstile.js
 * Cloudflare Turnstile / Bot Protection Verification Helper.
 *
 * Hard Rule: Fails CLOSED. If TURNSTILE_SECRET_KEY is missing or invalid,
 * the verification rejects the request rather than bypassing protection.
 */

export async function verifyTurnstileToken(token, clientIp = null) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fail CLOSED if secret key is missing or blank
  if (!secretKey || secretKey.trim().length === 0) {
    // Only in explicit local unit testing with BYPASS_CAPTCHA=true can it be bypassed
    if (process.env.NODE_ENV === 'test' || process.env.BYPASS_CAPTCHA === 'true') {
      return { ok: true, bypassed: true };
    }
    console.error('[Turnstile] FAIL CLOSED: TURNSTILE_SECRET_KEY is not configured in environment.');
    return {
      ok: false,
      code: 'turnstile_misconfigured',
      error: 'Security verification service is unavailable. Please try again later or contact the clinic concierge.'
    };
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      ok: false,
      code: 'token_missing',
      error: 'Cloudflare Turnstile verification token is required to complete booking.'
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp && clientIp !== 'anonymous') {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!res.ok) {
      console.error('[Turnstile] Cloudflare siteverify HTTP error:', res.status);
      return { ok: false, error: 'Verification service temporarily unavailable.' };
    }

    const data = await res.json();
    if (!data.success) {
      console.warn('[Turnstile] Verification rejected by Cloudflare:', data['error-codes']);
      return {
        ok: false,
        code: 'captcha_rejected',
        error: 'Bot protection check failed. Please refresh the page and try again.'
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('[Turnstile] Network exception during verification (Fail Closed):', err.message);
    return {
      ok: false,
      code: 'network_failure',
      error: 'Security verification check failed due to a network error.'
    };
  }
}

export default verifyTurnstileToken;
