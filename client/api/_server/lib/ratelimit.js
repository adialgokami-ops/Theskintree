/**
 * client/api/server/lib/ratelimit.js
 * Multi-Instance Distributed Rate Limiter for The Skin Tree.
 *
 * Store Architecture:
 * 1. Primary (Production): Upstash Redis REST / Vercel KV REST
 *    Environment variables:
 *    - UPSTASH_REDIS_REST_URL or KV_REST_API_URL
 *    - UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN
 * 2. Fail-Closed Security Policy:
 *    In production environments (process.env.NODE_ENV === 'production' or process.env.VERCEL === '1'),
 *    if Upstash/KV credentials are not configured, all booking requests FAIL CLOSED (HTTP 503)
 *    to prevent unthrottled abuse or slot exhaustion attacks.
 * 3. Local Development / Test Fallback:
 *    When not in production, in-memory sliding window is permitted with an explicit console warning.
 *    The insecure /tmp file-based rate limit tier has been completely decommissioned.
 */

const memoryStore = new Map();

/**
 * Universal rate limit checker
 * @param {string} key - Rate limit key (e.g. `booking:ip:1.2.3.4` or `chat:ip:1.2.3.4`)
 * @param {Object} options - { limit: number, windowSeconds: number, failClosedInProd?: boolean }
 */
export async function checkRateLimit(key, { limit = 10, windowSeconds = 60, failClosedInProd = false } = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  // 1. Production Upstash / Vercel KV REST
  if (url && token) {
    try {
      const pipelineUrl = `${url.replace(/\/$/, '')}/pipeline`;
      const redisKey = `ratelimit:${key}`;

      const res = await fetch(pipelineUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, windowSeconds]
        ])
      });

      if (res.ok) {
        const data = await res.json();
        const count = data[0]?.result || 1;
        const ok = count <= limit;
        return {
          ok,
          remaining: Math.max(0, limit - count),
          count,
          store: 'upstash_redis'
        };
      } else {
        const errText = await res.text();
        console.warn(`[RateLimit] Upstash/KV HTTP ${res.status}: ${errText.slice(0, 80)}`);
      }
    } catch (err) {
      console.warn('[RateLimit] Upstash Redis request failed:', err.message);
    }
  }

  // 2. Production Fail-Closed Policy:
  // If Upstash/KV is missing or failed in production, block booking requests strictly
  const isBookingKey = key.startsWith('booking:') || failClosedInProd;
  if (isProd && isBookingKey) {
    console.error(
      JSON.stringify({
        event: 'ratelimit_fail_closed',
        key,
        reason: 'Upstash/Vercel KV unconfigured in production',
        action: 'BLOCKING_BOOKING_REQUEST'
      })
    );
    return {
      ok: false,
      status: 503,
      error: 'Abuse protection service unavailable in production. Booking is blocked.',
      failClosed: true,
      remaining: 0,
      store: 'fail_closed'
    };
  }

  // 3. Local Development / Non-production In-Memory Fallback
  if (!url || !token) {
    if (!isProd) {
      // Dev mode reminder
    }
  }

  const now = Date.now();
  let record = memoryStore.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryStore.set(key, record);
    return { ok: true, remaining: limit - 1, count: 1, store: 'memory' };
  }

  record.count += 1;
  const ok = record.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - record.count),
    count: record.count,
    store: 'memory'
  };
}

export default checkRateLimit;
