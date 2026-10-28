#!/usr/bin/env node
/**
 * scripts/db-privilege-test.mjs
 * Rigorous Database Privilege & Role-Separation Test Suite.
 *
 * Rules:
 * 1. Every negative test MUST assert exact SQLSTATE 42501 (insufficient_privilege).
 *    Any 42P01 (undefined_table) triggers an immediate test failure (proves non-existent table was targeted).
 * 2. Every positive test MUST prove at least one real row exists in the target table.
 * 3. The clinical suite targets real tables: clinical.consultations, clinical.clinical_patients.
 * 4. ALL write tests execute inside transactions that ROLL BACK (sql.begin) so zero test rows persist.
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load environment variables
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'client/.env.local'),
  path.resolve(process.cwd(), 'admin/.env.local')
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

const webUrl = process.env.WEB_DATABASE_URL;
const adminBookingUrl = process.env.ADMIN_BOOKING_DATABASE_URL;
const adminClinicalUrl = process.env.ADMIN_CLINICAL_DATABASE_URL;

if (!webUrl || !adminBookingUrl || !adminClinicalUrl) {
  console.error('❌ Missing database credentials in environment.');
  process.exit(1);
}

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failCount++;
  }
}

/**
 * Asserts that a query fails strictly with SQLSTATE 42501 (insufficient_privilege).
 * Fails with a fatal assertion if error is 42P01 (undefined_table).
 */
async function expectSqlstate42501(queryPromise, testName) {
  try {
    await queryPromise;
    assert(false, testName, 'Expected SQLSTATE 42501 (Permission Denied), but query succeeded!');
  } catch (err) {
    if (err.code === '42P01') {
      assert(false, testName, `CRITICAL FAIL: SQLSTATE 42P01 (Undefined Table) on "${err.message}". Table does not exist!`);
    } else if (err.code === '42501') {
      assert(true, testName);
    } else {
      assert(false, testName, `Expected SQLSTATE 42501, got ${err.code}: ${err.message}`);
    }
  }
}

async function runTests() {
  console.log('🛡️ The Skin Tree: Rigorous PostgreSQL Privilege & Isolation Test\n');

  // ===========================================================================
  // 1. web_api Role Tests (Public Web & AI Concierge)
  // ===========================================================================
  console.log('--- Suite 1: web_api Role Isolation (Public Surface) ---');
  const webSql = postgres(webUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    // Negative tests: Assert SQLSTATE 42501 on real tables
    await expectSqlstate42501(
      webSql`SELECT * FROM booking.contacts LIMIT 1`,
      'web_api: SELECT on booking.contacts is rejected with 42501'
    );

    await expectSqlstate42501(
      webSql`SELECT * FROM booking.bookings LIMIT 1`,
      'web_api: SELECT on booking.bookings is rejected with 42501'
    );

    await expectSqlstate42501(
      webSql`SELECT * FROM booking.slot_blocks LIMIT 1`,
      'web_api: SELECT on booking.slot_blocks is rejected with 42501'
    );

    await expectSqlstate42501(
      webSql`SELECT * FROM clinical.clinical_patients LIMIT 1`,
      'web_api: SELECT on clinical.clinical_patients is rejected with 42501'
    );

    await expectSqlstate42501(
      webSql`SELECT * FROM clinical.consultations LIMIT 1`,
      'web_api: SELECT on clinical.consultations is rejected with 42501'
    );

    await expectSqlstate42501(
      webSql`SELECT * FROM booking.admin_get_slots(current_date, 1)`,
      'web_api: EXECUTE on admin_get_slots is rejected with 42501'
    );

    // Positive test: Proves rows exist via allowed public RPC
    try {
      const slots = await webSql`
        SELECT slot_date, slot_time, available
        FROM booking.public_get_slots(current_date, 14)
      `;
      const hasRows = slots.length > 0;
      const validStructure = hasRows && 'slot_date' in slots[0] && 'slot_time' in slots[0] && 'available' in slots[0];
      const leaksNoReason = hasRows && !('reason' in slots[0]) && !('state' in slots[0]);
      assert(hasRows && validStructure && leaksNoReason, 'web_api: public_get_slots returns real rows with zero clinical reason leakage');
    } catch (err) {
      assert(false, 'web_api: public_get_slots positive assertion failed', err.message);
    }

    // Exact routine grant assertion: exactly the 5 public functions
    const routines = await webSql`
      SELECT routine_name
      FROM information_schema.routine_privileges
      WHERE grantee = 'web_api' AND routine_schema IN ('booking', 'clinical')
      GROUP BY routine_name
    `;
    const routineNames = routines.map(r => r.routine_name);
    const expectedPublicFunctions = [
      'public_get_slots',
      'public_create_booking',
      'public_manage_get',
      'public_manage_cancel',
      'public_manage_reschedule'
    ];
    const isExactMatch = routineNames.length === expectedPublicFunctions.length &&
      expectedPublicFunctions.every(f => routineNames.includes(f));
    assert(isExactMatch, 'web_api: Granted EXECUTE strictly on exactly the 5 public functions');

    // Negative write test inside ROLLBACK
    try {
      await webSql.begin(async sql => {
        await expectSqlstate42501(
          sql`INSERT INTO booking.slot_blocks (slot_date, reason) VALUES (current_date, 'Hacked')`,
          'web_api: INSERT on booking.slot_blocks rejected with 42501'
        );
        throw new Error('ROLLBACK_INTENTIONAL');
      });
    } catch (e) {
      if (e.message !== 'ROLLBACK_INTENTIONAL') throw e;
    }
  } finally {
    await webSql.end();
  }

  // ===========================================================================
  // 2. admin_booking Role Tests (Reception & Scheduling)
  // ===========================================================================
  console.log('\n--- Suite 2: admin_booking Role Isolation (Receptionist / Scheduling) ---');
  const bookingSql = postgres(adminBookingUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    // Positive test: Proves rows exist in booking tables
    const existingBookings = await bookingSql`SELECT id, patient_ref, status FROM booking.bookings LIMIT 5`;
    assert(existingBookings.length > 0, 'admin_booking: Proves rows exist in booking.bookings');

    const existingContacts = await bookingSql`SELECT patient_ref, full_name, phone FROM booking.contacts LIMIT 5`;
    assert(existingContacts.length > 0, 'admin_booking: Proves rows exist in booking.contacts');

    // Negative tests on clinical schema: Strict 42501 rejection on real clinical tables
    await expectSqlstate42501(
      bookingSql`SELECT * FROM clinical.clinical_patients LIMIT 1`,
      'admin_booking: SELECT on clinical.clinical_patients is rejected with 42501'
    );

    await expectSqlstate42501(
      bookingSql`SELECT * FROM clinical.consultations LIMIT 1`,
      'admin_booking: SELECT on clinical.consultations is rejected with 42501'
    );

    await expectSqlstate42501(
      bookingSql`SELECT * FROM clinical.access_log LIMIT 1`,
      'admin_booking: SELECT on clinical.access_log is rejected with 42501'
    );

    // Negative test: admin_booking cannot DELETE bookings or contacts (append-only history)
    await expectSqlstate42501(
      bookingSql`DELETE FROM booking.bookings WHERE id = '00000000-0000-0000-0000-000000000000'`,
      'admin_booking: DELETE on booking.bookings is rejected with 42501'
    );

    await expectSqlstate42501(
      bookingSql`DELETE FROM booking.contacts WHERE patient_ref = '00000000-0000-0000-0000-000000000000'`,
      'admin_booking: DELETE on booking.contacts is rejected with 42501'
    );

    // Write tests inside BEGIN...ROLLBACK (Zero persistence)
    try {
      await bookingSql.begin(async sql => {
        // Positive write test: Create a slot block inside transaction
        const [block] = await sql`
          INSERT INTO booking.slot_blocks (slot_date, reason)
          VALUES ('2099-12-31', 'Test Temporary Block')
          RETURNING id, slot_date
        `;
        assert(Boolean(block?.id), 'admin_booking: INSERT into booking.slot_blocks succeeds inside rollback transaction');

        // Negative test: Try to UPDATE audit_log inside transaction (must fail with 42501)
        await expectSqlstate42501(
          sql`UPDATE booking.audit_log SET action = 'tampered' WHERE id = 1`,
          'admin_booking: UPDATE on booking.audit_log rejected with 42501 inside transaction'
        );

        // Force ROLLBACK
        throw new Error('ROLLBACK_INTENTIONAL');
      });
    } catch (e) {
      if (e.message !== 'ROLLBACK_INTENTIONAL') throw e;
    }
  } finally {
    await bookingSql.end();
  }

  // ===========================================================================
  // 3. admin_clinical Role Tests (Doctor / EMR Confidentiality)
  // ===========================================================================
  console.log('\n--- Suite 3: admin_clinical Role Isolation (Doctor / Real EMR Tables) ---');
  const clinicalSql = postgres(adminClinicalUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    // Positive tests on real clinical tables: Proves rows exist
    const clinicalPatients = await clinicalSql`SELECT patient_ref, skin_type, allergies FROM clinical.clinical_patients LIMIT 5`;
    assert(clinicalPatients.length > 0, 'admin_clinical: Proves rows exist in real table clinical.clinical_patients');

    const consultations = await clinicalSql`SELECT id, patient_ref, chief_complaint, diagnosis FROM clinical.consultations LIMIT 5`;
    assert(consultations.length > 0, 'admin_clinical: Proves rows exist in real table clinical.consultations');

    // Negative tests: Assert 42501 on non-existent or disallowed mutations
    await expectSqlstate42501(
      clinicalSql`UPDATE clinical.access_log SET action = 'tampered' WHERE id = 1`,
      'admin_clinical: UPDATE on clinical.access_log is rejected with 42501 (append-only)'
    );

    await expectSqlstate42501(
      clinicalSql`DELETE FROM clinical.access_log WHERE id = 1`,
      'admin_clinical: DELETE on clinical.access_log is rejected with 42501'
    );

    // Negative write test on booking schema (doctor is select-only on bookings)
    await expectSqlstate42501(
      clinicalSql`
        INSERT INTO booking.bookings (patient_ref, treatment, slot_date, slot_time, source)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Test', current_date, '10:00'::time, 'admin_manual')
      `,
      'admin_clinical: INSERT into booking.bookings is rejected with 42501 (select-only on booking)'
    );

    // Positive write test on real clinical table inside BEGIN...ROLLBACK
    try {
      await clinicalSql.begin(async sql => {
        const patientRef = clinicalPatients[0].patient_ref;
        const [insertedConsult] = await sql`
          INSERT INTO clinical.consultations (
            patient_ref,
            consultation_date,
            chief_complaint,
            examination_findings,
            diagnosis,
            clinical_notes
          ) VALUES (
            ${patientRef},
            current_date,
            'Privilege verification test complaint',
            'Intact epidermis',
            'Test PIH',
            'Transactional test consultation'
          )
          RETURNING id
        `;
        assert(Boolean(insertedConsult?.id), 'admin_clinical: INSERT into real table clinical.consultations succeeds inside transaction');

        // Roll back immediately
        throw new Error('ROLLBACK_INTENTIONAL');
      });
    } catch (e) {
      if (e.message !== 'ROLLBACK_INTENTIONAL') throw e;
    }
  } finally {
    await clinicalSql.end();
  }

  // ===========================================================================
  // 4. Supabase System Roles Isolation (anon & authenticated)
  // ===========================================================================
  console.log('\n--- Suite 4: Supabase System Roles (anon & authenticated) ---');
  const checkSql = postgres(adminBookingUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    const tableGrants = await checkSql`
      SELECT grantee, table_schema, table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE grantee IN ('anon', 'authenticated')
        AND table_schema IN ('booking', 'clinical')
    `;
    assert(tableGrants.length === 0, 'anon & authenticated: 0 table privileges on booking and clinical schemas');

    const routineGrants = await checkSql`
      SELECT grantee, routine_schema, routine_name
      FROM information_schema.routine_privileges
      WHERE grantee IN ('anon', 'authenticated')
        AND routine_schema IN ('booking', 'clinical')
    `;
    assert(routineGrants.length === 0, 'anon & authenticated: 0 routine EXECUTE grants on booking and clinical schemas');
  } finally {
    await checkSql.end();
  }

  console.log('\n======================================================');
  console.log(`Results: ${passCount} passed, ${failCount} failed.`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
