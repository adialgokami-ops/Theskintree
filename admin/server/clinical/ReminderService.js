/**
 * ReminderService
 * Step 5: Privacy-preserving outreach service.
 * Accessible to reception, doctor, and admin.
 * Queries NEVER select or return diagnoses, clinical issues, doctor notes, or medication names.
 * Returns only { patient_ref, name, phone, kind, dueDate }.
 */

import { ReminderDTO } from './DTOs.js';

export class ReminderService {
  #store;
  #actor;

  constructor(store, actor) {
    this.#store = store;
    this.#actor = actor;
  }

  /**
   * Fetch follow-up reminders due.
   * Strictly queries patient_ref and follow_up_date ONLY.
   * Never selects diagnosis, clinical notes, or examination findings.
   */
  async getFollowUpRemindersDue() {
    if (!this.#store) return [];
    const sql = this.#store.sql;

    // Follow-ups due on or before today in Asia/Kolkata
    // Joins with booking.contacts for name/phone (admin_clinical has select on booking.contacts)
    const rows = await sql`
      select
        c.patient_ref,
        ct.full_name as name,
        ct.phone,
        'followup' as kind,
        c.follow_up_date as due_date
      from clinical.consultations c
      join booking.contacts ct on c.patient_ref = ct.patient_ref
      where c.follow_up_date is not null
        and c.follow_up_date <= (now() at time zone 'Asia/Kolkata')::date
      order by c.follow_up_date asc
      limit 50
    `;

    return rows.map(
      (r) =>
        new ReminderDTO({
          patient_ref: r.patient_ref,
          name: r.name,
          phone: r.phone,
          kind: 'followup',
          dueDate: r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date)
        })
    );
  }

  /**
   * Fetch active medication reminder candidates.
   * Strictly queries patient_ref and start_date.
   * Never selects medication name, dosage, or instructions.
   */
  async getActiveMedicationChecks() {
    if (!this.#store) return [];
    const sql = this.#store.sql;

    const rows = await sql`
      select
        m.patient_ref,
        ct.full_name as name,
        ct.phone,
        'medication' as kind,
        m.start_date as due_date
      from clinical.medications m
      join booking.contacts ct on m.patient_ref = ct.patient_ref
      where m.status = 'active'
      order by m.start_date asc
      limit 50
    `;

    return rows.map(
      (r) =>
        new ReminderDTO({
          patient_ref: r.patient_ref,
          name: r.name,
          phone: r.phone,
          kind: 'medication',
          dueDate: r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date)
        })
    );
  }

  /**
   * Log outreach transmission into clinical.reminder_log.
   */
  async logReminderSent({ patientRef, channel = 'whatsapp', reminderType, payload = {} }) {
    if (!this.#store) return { id: null, sent_at: new Date().toISOString() };
    const sql = this.#store.sql;

    const [logged] = await sql`
      insert into clinical.reminder_log (
        patient_ref, channel, reminder_type, template_name, status, payload
      ) values (
        ${patientRef},
        ${channel},
        ${reminderType},
        ${'manual_' + reminderType},
        'sent',
        ${sql.json({ ...payload, sent_by: this.#actor?.user_id || null })}
      )
      returning id, sent_at
    `;

    return logged;
  }
}
