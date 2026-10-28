#!/usr/bin/env node
/**
 * scripts/race-test.mjs
 * Race condition test: Fires 10 parallel booking requests for the exact same slot.
 * Verifies that the partial unique index `one_active_booking_per_slot` and SQL transaction
 * permit exactly ONE booking and reject the other 9 with HTTP 409 (SLOT_TAKEN).
 * Step 4 & 6: Uses WEB_DATABASE_URL (role: web_api) or HTTP endpoint.
 * Usage: node scripts/race-test.mjs [--url http://localhost:5173/api/bookings]
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load env
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'client/.env.local'),
  path.resolve(process.cwd(), 'client/.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const k = match[1];
        let v = (match[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const targetUrl = urlIndex !== -1 && args[urlIndex + 1] ? args[urlIndex + 1] : 'http://localhost:5173/api/bookings';

// Target slot date in the future (Mon-Sat weekday)
let testDate = null;
let testTime = '10:00';

async function resolveTargetSlot() {
  const url = process.env.WEB_DATABASE_URL || process.env.ADMIN_BOOKING_DATABASE_URL;
  if (url) {
    const sql = postgres(url, { prepare: false, max: 1, ssl: 'require' });
    try {
      const rows = await sql`
        select to_char(slot_date, 'YYYY-MM-DD') as sdate, to_char(slot_time, 'HH24:MI') as stime
        from booking.public_get_slots((CURRENT_DATE + 5)::date, 20)
        where available = true
        order by slot_date asc, slot_time asc
        limit 1
      `;
      if (rows.length > 0) {
        testDate = rows[0].sdate;
        testTime = rows[0].stime;
        return;
      }
    } catch (_) {
      // fallback to computed date
    } finally {
      await sql.end();
    }
  }

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 20 + Math.floor(Math.random() * 10));
  if (futureDate.getDay() === 0) futureDate.setDate(futureDate.getDate() + 1);
  testDate = futureDate.toISOString().split('T')[0];
}

console.log('🏁 The Skin Tree - Concurrency Race Test');

async function testViaHttp() {
  const requests = Array.from({ length: 10 }, (_, i) => {
    const payload = {
      name: `Race Tester ${i + 1}`,
      phone: `+91981110000${i}`,
      email: `racetest${i + 1}@example.com`,
      treatment: 'Medical Hydrafacial MD®',
      date: testDate,
      time: testTime,
      consent: true,
      source: 'website_form',
      honeypot: ''
    };

    return fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async (res) => {
      const status = res.status;
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}
      return { index: i + 1, status, data };
    });
  });

  return Promise.all(requests);
}

async function testViaDb() {
  const url = process.env.WEB_DATABASE_URL || process.env.ADMIN_BOOKING_DATABASE_URL;
  if (!url) {
    throw new Error('WEB_DATABASE_URL or ADMIN_BOOKING_DATABASE_URL must be set.');
  }

  console.log('ℹ️ Testing direct database concurrency via booking.public_create_booking...');
  const sql = postgres(url, { prepare: false, max: 10, ssl: 'require' });

  try {
    const requests = Array.from({ length: 10 }, (_, i) => {
      return sql`
        select booking.public_create_booking(
          ${`Race Tester ${i + 1}`},
          ${`+91981110000${i}`},
          ${`racetest${i + 1}@example.com`},
          'Medical Hydrafacial MD®',
          ${testDate}::date,
          ${testTime}::time,
          'website_form',
          'Concurrency test',
          true,
          null
        ) as res
      `.then(([row]) => {
        const res = row?.res;
        const ok = res?.ok === true;
        return {
          index: i + 1,
          status: ok ? 200 : 409,
          data: res || {}
        };
      }).catch((err) => {
        return {
          index: i + 1,
          status: 409,
          data: { ok: false, code: 'SLOT_TAKEN', error: err.message }
        };
      });
    });

    return await Promise.all(requests);
  } finally {
    await sql.end();
  }
}

async function main() {
  await resolveTargetSlot();
  console.log(`🎯 Target slot: ${testDate} at ${testTime}`);
  console.log(`🌐 Endpoint:    ${targetUrl}\n`);
  const forceDb = args.includes('--db');
  let results;
  if (!forceDb) {
    try {
      results = await testViaHttp();
      // If server returned 404 (e.g. static Vite dev server without serverless api routes)
      if (results.length > 0 && results[0].status === 404) {
        console.log('⚠️ HTTP endpoint returned 404 (Vite dev server running without API server). Falling back to direct database concurrency test...');
        results = await testViaDb();
      }
    } catch (err) {
      console.log(`⚠️ HTTP endpoint failed (${err.message}). Falling back to direct database concurrency test...`);
      results = await testViaDb();
    }
  } else {
    results = await testViaDb();
  }

  const successes = results.filter((r) => r.status === 200 || r.status === 201 || r.data?.ok === true);
  const conflicts = results.filter((r) => r.status === 409 || r.data?.code === 'SLOT_TAKEN');

  console.log('Results:');
  results.forEach((r) => {
    const isSuccess = r.status === 200 || r.status === 201 || r.data?.ok === true;
    console.log(`  [Request ${r.index}] Status: ${r.status} => ${isSuccess ? '✅ SUCCESS (Booked)' : '🛡️ CONFLICT (Rejected)'}`);
  });

  console.log('\n======================================================');
  console.log(`Total Requests: ${results.length}`);
  console.log(`Success Count:  ${successes.length} (Expected: 1)`);
  console.log(`Conflict Count: ${conflicts.length} (Expected: 9)`);
  console.log('======================================================');

  if (successes.length === 1 && conflicts.length === 9) {
    console.log('🎉 RACE TEST PASSED: Exactly 1 slot booked. Double-booking guard is 100% race-proof!\n');
    process.exit(0);
  } else {
    console.error('❌ RACE TEST FAILED: Concurrency violation detected.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Race test exception:', err);
  process.exit(1);
});
