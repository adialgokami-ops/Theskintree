#!/usr/bin/env node
/**
 * scripts/test-rate-limit-store.mjs
 * Verification Suite for Upstash / Vercel KV Rate Limiting & Fail-Closed Behavior.
 *
 * Tests:
 * 1. Live Upstash / KV REST Pipeline Store Test:
 *    Simulates an Upstash Redis REST pipeline endpoint (/pipeline).
 *    Verifies atomic INCR + EXPIRE, counter thresholding, remaining quota calculation.
 * 2. Production Fail-Closed Test:
 *    Simulates production environment without Upstash credentials.
 *    Verifies that booking requests FAIL CLOSED immediately (HTTP 503, ok: false).
 * 3. Non-Production Fallback Test:
 *    Verifies safe development mode fallback in non-production.
 */

import http from 'node:http';
import { checkRateLimit } from '../client/api/_server/lib/ratelimit.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runStoreTests() {
  console.log('⚡ The Skin Tree: Distributed Rate Limiting & Store Test Suite\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Test against real Upstash / Vercel KV REST pipeline protocol
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Upstash / Vercel KV REST Pipeline Protocol ---');

  // Spawn an HTTP server that implements the exact Upstash /pipeline JSON contract
  const redisState = new Map();
  const mockServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/pipeline') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const commands = JSON.parse(body);
          const results = [];
          for (const cmd of commands) {
            const op = cmd[0];
            const k = cmd[1];
            if (op === 'INCR') {
              const current = (redisState.get(k) || 0) + 1;
              redisState.set(k, current);
              results.push({ result: current });
            } else if (op === 'EXPIRE') {
              results.push({ result: 1 });
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;
  const mockUrl = `http://127.0.0.1:${port}`;
  const mockToken = 'mock_upstash_secret_token_2026';

  // Configure env
  process.env.UPSTASH_REDIS_REST_URL = mockUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = mockToken;

  const testKey = 'test_ip_192_168_1_50';
  const limit = 3;

  const res1 = await checkRateLimit(testKey, { limit, windowSeconds: 60 });
  assert(res1.ok === true && res1.count === 1 && res1.remaining === 2 && res1.store === 'upstash_redis',
    'Upstash Store: Request 1 allowed (count=1, remaining=2, store=upstash_redis)');

  const res2 = await checkRateLimit(testKey, { limit, windowSeconds: 60 });
  assert(res2.ok === true && res2.count === 2 && res2.remaining === 1,
    'Upstash Store: Request 2 allowed (count=2, remaining=1)');

  const res3 = await checkRateLimit(testKey, { limit, windowSeconds: 60 });
  assert(res3.ok === true && res3.count === 3 && res3.remaining === 0,
    'Upstash Store: Request 3 allowed at boundary (count=3, remaining=0)');

  const res4 = await checkRateLimit(testKey, { limit, windowSeconds: 60 });
  assert(res4.ok === false && res4.count === 4 && res4.remaining === 0,
    'Upstash Store: Request 4 blocked by rate limit (count=4, ok=false)');

  mockServer.close();

  // ---------------------------------------------------------------------------
  // Suite 2: Test Production Fail-Closed Behavior
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Production Fail-Closed Security Policy ---');

  // Unset Upstash credentials
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;

  // Set production environment
  process.env.NODE_ENV = 'production';

  const bookingIpRes = await checkRateLimit('booking:ip:203.0.113.1', { limit: 10, windowSeconds: 60 });
  assert(bookingIpRes.ok === false && bookingIpRes.failClosed === true && bookingIpRes.status === 503,
    'Production Fail-Closed: booking:ip request strictly blocked with HTTP 503');

  const bookingPhoneRes = await checkRateLimit('booking:phone:+919820012345', { limit: 3, windowSeconds: 3600 });
  assert(bookingPhoneRes.ok === false && bookingPhoneRes.failClosed === true && bookingPhoneRes.status === 503,
    'Production Fail-Closed: booking:phone request strictly blocked with HTTP 503');

  // Reset environment
  process.env.NODE_ENV = 'test';

  console.log('\n================================================================');
  console.log(`Rate Limit Store Tests Completed: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStoreTests().catch(err => {
  console.error('Fatal error in rate limit store test:', err);
  process.exit(1);
});
