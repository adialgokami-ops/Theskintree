#!/usr/bin/env node
/**
 * scripts/test-rate-limit-instances.mjs
 * Test proving that rate limits hold across two distinct Node.js instances/processes.
 *
 * Spawns Instance A and Instance B in separate child processes.
 * Both instances target the same rate limit key (`test:shared_ip:203.0.113.99`) with limit = 5.
 *
 * Sequence:
 * - Instance A sends 3 requests (Counts 1, 2, 3 -> All OK)
 * - Instance B sends 3 requests (Counts 4, 5 -> OK; Count 6 -> REJECTED / Rate Limited)
 *
 * Exits with 0 if Instance B is blocked on request 6.
 * Exits with 1 if Instance B was not blocked (i.e. if state was isolated per-instance).
 */

import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SHARED_TEST_FILE = '/tmp/.test_ratelimit_instances.json';
if (fs.existsSync(SHARED_TEST_FILE)) {
  fs.unlinkSync(SHARED_TEST_FILE);
}

// If invoked as a worker instance child process:
if (process.env.IS_RATELIMIT_WORKER === 'true') {
  const { checkRateLimit } = await import('../client/api/_server/lib/ratelimit.js');
  process.on('message', async (msg) => {
    if (msg.type === 'CHECK') {
      const res = await checkRateLimit(msg.key, { limit: msg.limit, windowSeconds: 60 });
      process.send({ type: 'RESULT', instance: process.env.INSTANCE_NAME, res });
    }
  });
} else {
  // Master coordinator
  console.log('🧪 Testing Multi-Instance Shared Rate Limiter...\n');

  const instanceA = fork(new URL(import.meta.url).pathname, [], {
    env: { ...process.env, IS_RATELIMIT_WORKER: 'true', INSTANCE_NAME: 'Instance-A', RATELIMIT_SHARED_FILE: SHARED_TEST_FILE }
  });

  const instanceB = fork(new URL(import.meta.url).pathname, [], {
    env: { ...process.env, IS_RATELIMIT_WORKER: 'true', INSTANCE_NAME: 'Instance-B', RATELIMIT_SHARED_FILE: SHARED_TEST_FILE }
  });

  const sendCheck = (worker, key, limit) => {
    return new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.type === 'RESULT') {
          worker.off('message', handler);
          resolve(msg);
        }
      };
      worker.on('message', handler);
      worker.send({ type: 'CHECK', key, limit });
    });
  };

  try {
    const key = 'test:shared_client_ip:203.0.113.99';
    const limit = 5;

    console.log(`Configuring Limit = ${limit} requests for key: "${key}" across 2 instances.`);

    // 1. Instance A makes 3 requests
    console.log('\n--- Phase 1: Instance A sends 3 requests ---');
    for (let i = 1; i <= 3; i++) {
      const resA = await sendCheck(instanceA, key, limit);
      console.log(`  [Instance-A] Request ${i}: ok = ${resA.res.ok}, count = ${resA.res.count}, remaining = ${resA.res.remaining}`);
      if (!resA.res.ok) throw new Error(`Instance A prematurely blocked on request ${i}`);
    }

    // 2. Instance B makes 3 requests
    console.log('\n--- Phase 2: Instance B sends 3 requests ---');
    const b1 = await sendCheck(instanceB, key, limit);
    console.log(`  [Instance-B] Request 1 (Global #4): ok = ${b1.res.ok}, count = ${b1.res.count}, remaining = ${b1.res.remaining}`);

    const b2 = await sendCheck(instanceB, key, limit);
    console.log(`  [Instance-B] Request 2 (Global #5): ok = ${b2.res.ok}, count = ${b2.res.count}, remaining = ${b2.res.remaining}`);

    const b3 = await sendCheck(instanceB, key, limit);
    console.log(`  [Instance-B] Request 3 (Global #6): ok = ${b3.res.ok}, count = ${b3.res.count}, remaining = ${b3.res.remaining}`);

    console.log('\n======================================================');
    if (b1.res.ok && b2.res.ok && !b3.res.ok) {
      console.log('✅ TEST PASSED: Limits successfully held across multiple instances!');
      console.log('   Global counter correctly reached 6 on Instance-B and rejected request #6.');
      console.log('======================================================\n');
      process.exit(0);
    } else {
      console.error('❌ TEST FAILED: Instance B did not enforce the shared limit!');
      console.log('======================================================\n');
      process.exit(1);
    }
  } finally {
    instanceA.kill();
    instanceB.kill();
    if (fs.existsSync(SHARED_TEST_FILE)) fs.unlinkSync(SHARED_TEST_FILE);
  }
}
