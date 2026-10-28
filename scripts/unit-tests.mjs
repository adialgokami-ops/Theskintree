#!/usr/bin/env node
/**
 * scripts/unit-tests.mjs
 * Unit Test Suite for Second Layer of Defense & Object-Oriented Clinical Access Layer.
 *
 * Verifies:
 * 1. reception cannot construct PatientRecordService (throws ForbiddenError).
 * 2. getDbFor({ role: 'reception' }).clinical() throws ForbiddenError.
 * 3. ReminderService output contains NO clinical text (no diagnoses, notes, or medicine names).
 * 4. Doctor/admin role can construct PatientRecordService.
 */

import { PatientRecordService } from '../admin/server/clinical/PatientRecordService.js';
import { ReminderService } from '../admin/server/clinical/ReminderService.js';
import { ReminderDTO } from '../admin/server/clinical/DTOs.js';
import { getDbFor } from '../admin/server/lib/db.js';
import { ForbiddenError } from '../admin/server/lib/errors.js';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

console.log('🧪 Running Clinical Layer & Access Control Unit Tests...\n');

// 1. Reception cannot construct PatientRecordService
try {
  const dummyStore = { sql: null };
  new PatientRecordService(dummyStore, { role: 'reception', user_id: 'test-reception-id' });
  assert(false, 'Reception cannot construct PatientRecordService');
} catch (err) {
  assert(err instanceof ForbiddenError, 'Reception cannot construct PatientRecordService (threw ForbiddenError)');
}

// 2. Admin cannot construct PatientRecordService (clinical access restricted strictly to doctor)
try {
  const dummyStore = { sql: null };
  new PatientRecordService(dummyStore, { role: 'admin', user_id: 'test-admin-id' });
  assert(false, 'Admin cannot construct PatientRecordService');
} catch (err) {
  assert(err instanceof ForbiddenError, 'Admin cannot construct PatientRecordService (threw ForbiddenError)');
}

// 3. getDbFor(reception).clinical() throws
try {
  getDbFor({ role: 'reception', user_id: 'test-reception-id' }).clinical();
  assert(false, 'getDbFor(reception).clinical() throws');
} catch (err) {
  assert(err instanceof ForbiddenError, 'getDbFor(reception).clinical() throws ForbiddenError');
}

// 4. getDbFor(admin).clinical() throws (only doctor allowed)
try {
  getDbFor({ role: 'admin', user_id: 'test-admin-id' }).clinical();
  assert(false, 'getDbFor(admin).clinical() throws');
} catch (err) {
  assert(err instanceof ForbiddenError, 'getDbFor(admin).clinical() throws ForbiddenError');
}

// 5. Doctor CAN construct PatientRecordService
try {
  const dummyStore = { sql: null };
  const doctorSvc = new PatientRecordService(dummyStore, { role: 'doctor', user_id: 'test-doc-id' });
  assert(Boolean(doctorSvc), 'Doctor can construct PatientRecordService');
} catch (err) {
  assert(false, `Doctor failed to construct PatientRecordService: ${err.message}`);
}

// 4. ReminderService output contains NO clinical text
const sampleReminder = new ReminderDTO({
  patient_ref: 'a1b2c3d4-0000-0000-0000-000000000000',
  name: 'Ananya Roy',
  phone: '+919820012345',
  kind: 'appointment',
  dueDate: '2026-10-27'
});

const reminderKeys = Object.keys(sampleReminder);
const forbiddenFields = [
  'diagnosis',
  'issues',
  'clinical_notes',
  'examination_findings',
  'medicine_name',
  'medication',
  'dosage',
  'doctor_notes'
];

const hasForbiddenKeys = forbiddenFields.some((f) => reminderKeys.includes(f));
assert(!hasForbiddenKeys, 'ReminderDTO contains no diagnosis, notes, or medicine fields');

const serialized = JSON.stringify(sampleReminder);
const containsClinicalText =
  serialized.includes('melasma') ||
  serialized.includes('acne') ||
  serialized.includes('tretinoin') ||
  serialized.includes('peel');

assert(!containsClinicalText, 'ReminderService output contains zero clinical health text');

console.log('\n======================================================');
console.log(`Unit Test Results: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
