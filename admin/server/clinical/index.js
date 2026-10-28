/**
 * Clinical Layer Entry Point
 * Step 5: Exports ONLY patientRecordsFor(actor) and remindersFor(actor).
 * ClinicalStore is NOT exported from this index.
 */

import { getDbFor } from '../lib/db.js';
import { ClinicalStore } from './ClinicalStore.js';
import { PatientRecordService } from './PatientRecordService.js';
import { ReminderService } from './ReminderService.js';

/**
 * Factory for PatientRecordService.
 * Enforces doctor role exclusively.
 */
export function patientRecordsFor(actor) {
  const clinicalDb = getDbFor(actor).clinical();
  const store = new ClinicalStore(clinicalDb);
  return new PatientRecordService(store, actor);
}

/**
 * Factory for ReminderService.
 * Allowed for reception, doctor, and admin.
 * Only doctor role receives clinical store; reception and admin operate on booking reminders.
 */
export function remindersFor(actor) {
  let store = null;
  if (actor?.role === 'doctor') {
    const clinicalDb = getDbFor(actor).clinical();
    store = new ClinicalStore(clinicalDb);
  }
  return new ReminderService(store, actor);
}
