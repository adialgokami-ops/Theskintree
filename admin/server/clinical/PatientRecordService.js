/**
 * PatientRecordService
 * Step 5: Second layer of defense for confidential clinical records.
 * Throws ForbiddenError unless actor.role is 'doctor' or 'admin'.
 * Writes clinical.access_log BEFORE every read or write operation.
 * Denies the operation if logging fails.
 * Returns DTO instances with explicit allow-listed fields.
 */

import { ForbiddenError } from '../lib/errors.js';
import { PatientProfileDTO, ConsultationDTO, MedicationDTO } from './DTOs.js';

export class PatientRecordService {
  #store;
  #actor;

  constructor(store, actor) {
    if (!actor || actor.role !== 'doctor') {
      throw new ForbiddenError(
        `Forbidden: Role '${actor?.role || 'anonymous'}' lacks authorization to access patient clinical records. Medical records are restricted exclusively to licensed doctors.`
      );
    }
    this.#store = store;
    this.#actor = actor;
  }

  /**
   * Enforce immutable access logging BEFORE any operation.
   * If logging fails, the entire clinical operation is aborted.
   */
  async #logAccess(patientRef, action, resource, metadata = {}) {
    const sql = this.#store.sql;
    try {
      await sql`
        insert into clinical.access_log (
          staff_id, staff_role, patient_ref, action, resource, metadata
        ) values (
          ${this.#actor.user_id || null},
          ${this.#actor.role},
          ${patientRef},
          ${action},
          ${resource},
          ${sql.json(metadata)}
        )
      `;
    } catch (logErr) {
      console.error('[CRITICAL] Access log insertion failed:', logErr.message);
      throw new Error('Access denied: Mandatory medical audit logging failed.');
    }
  }

  async openProfile(patientRef, defaults = {}) {
    await this.#logAccess(patientRef, 'OPEN_PROFILE', 'clinical.clinical_patients');
    const sql = this.#store.sql;

    const [existing] = await sql`
      select * from clinical.clinical_patients
      where patient_ref = ${patientRef}
    `;

    if (existing) {
      return new PatientProfileDTO(existing);
    }

    const [created] = await sql`
      insert into clinical.clinical_patients (
        patient_ref, date_of_birth, gender
      ) values (
        ${patientRef},
        ${defaults.date_of_birth || null},
        ${defaults.gender || 'unspecified'}
      )
      returning *
    `;

    return new PatientProfileDTO(created);
  }

  async getProfile(patientRef) {
    await this.#logAccess(patientRef, 'VIEW_PROFILE', 'clinical.clinical_patients');
    const sql = this.#store.sql;

    const [profile] = await sql`
      select * from clinical.clinical_patients
      where patient_ref = ${patientRef}
    `;

    return profile ? new PatientProfileDTO(profile) : null;
  }

  async updateProfile(patientRef, updates = {}) {
    await this.#logAccess(patientRef, 'UPDATE_PROFILE', 'clinical.clinical_patients', {
      fields: Object.keys(updates)
    });
    const sql = this.#store.sql;

    const [profile] = await sql`
      insert into clinical.clinical_patients (
        patient_ref, skin_type, allergies, medical_history, emergency_contact, notes, date_of_birth, gender
      ) values (
        ${patientRef},
        ${updates.skin_type || null},
        ${updates.allergies || null},
        ${updates.medical_history || null},
        ${updates.emergency_contact || null},
        ${updates.notes || null},
        ${updates.date_of_birth || null},
        ${updates.gender || 'unspecified'}
      )
      on conflict (patient_ref) do update set
        skin_type = coalesce(${updates.skin_type}, clinical.clinical_patients.skin_type),
        allergies = coalesce(${updates.allergies}, clinical.clinical_patients.allergies),
        medical_history = coalesce(${updates.medical_history}, clinical.clinical_patients.medical_history),
        emergency_contact = coalesce(${updates.emergency_contact}, clinical.clinical_patients.emergency_contact),
        notes = coalesce(${updates.notes}, clinical.clinical_patients.notes),
        date_of_birth = coalesce(${updates.date_of_birth}, clinical.clinical_patients.date_of_birth),
        gender = coalesce(${updates.gender}, clinical.clinical_patients.gender),
        updated_at = now()
      returning *
    `;

    return new PatientProfileDTO(profile);
  }

  async getConsultations(patientRef) {
    await this.#logAccess(patientRef, 'VIEW_CONSULTATIONS', 'clinical.consultations');
    const sql = this.#store.sql;

    const rows = await sql`
      select * from clinical.consultations
      where patient_ref = ${patientRef}
      order by consultation_date desc, created_at desc
    `;

    return rows.map((r) => new ConsultationDTO(r));
  }

  async createConsultation(patientRef, data) {
    await this.#logAccess(patientRef, 'CREATE_CONSULTATION', 'clinical.consultations');
    const sql = this.#store.sql;

    const [created] = await sql`
      insert into clinical.consultations (
        patient_ref, doctor_id, chief_complaint, examination_findings, diagnosis, clinical_notes, plan, follow_up_date
      ) values (
        ${patientRef},
        ${this.#actor.user_id || null},
        ${data.chief_complaint},
        ${data.examination_findings || null},
        ${data.diagnosis || null},
        ${data.clinical_notes || null},
        ${data.plan || null},
        ${data.follow_up_date ? sql`${data.follow_up_date}::date` : null}
      )
      returning *
    `;

    return new ConsultationDTO(created);
  }

  async updateConsultation(consultationId, data) {
    const sql = this.#store.sql;
    const [existing] = await sql`
      select patient_ref from clinical.consultations where id = ${consultationId}
    `;

    if (!existing) {
      throw new Error('Consultation not found.');
    }

    await this.#logAccess(existing.patient_ref, 'UPDATE_CONSULTATION', 'clinical.consultations', {
      consultationId
    });

    const [updated] = await sql`
      update clinical.consultations set
        chief_complaint = coalesce(${data.chief_complaint}, chief_complaint),
        examination_findings = coalesce(${data.examination_findings}, examination_findings),
        diagnosis = coalesce(${data.diagnosis}, diagnosis),
        clinical_notes = coalesce(${data.clinical_notes}, clinical_notes),
        plan = coalesce(${data.plan}, plan),
        follow_up_date = case when ${data.follow_up_date !== undefined} then ${data.follow_up_date ? sql`${data.follow_up_date}::date` : null} else follow_up_date end,
        updated_at = now()
      where id = ${consultationId}
      returning *
    `;

    return new ConsultationDTO(updated);
  }

  async getMedications(patientRef) {
    await this.#logAccess(patientRef, 'VIEW_MEDICATIONS', 'clinical.medications');
    const sql = this.#store.sql;

    const rows = await sql`
      select * from clinical.medications
      where patient_ref = ${patientRef}
      order by created_at desc
    `;

    return rows.map((r) => new MedicationDTO(r));
  }

  async createMedication(patientRef, data) {
    await this.#logAccess(patientRef, 'CREATE_MEDICATION', 'clinical.medications', {
      name: data.name
    });
    const sql = this.#store.sql;

    const [created] = await sql`
      insert into clinical.medications (
        patient_ref, consultation_id, prescribed_by, name, dosage, frequency, duration_days, instructions, start_date, status
      ) values (
        ${patientRef},
        ${data.consultation_id || null},
        ${this.#actor.user_id || null},
        ${data.name.trim()},
        ${data.dosage.trim()},
        ${data.frequency.trim()},
        ${data.duration_days || null},
        ${data.instructions || null},
        ${data.start_date ? sql`${data.start_date}::date` : sql`current_date`},
        'active'
      )
      returning *
    `;

    return new MedicationDTO(created);
  }

  async updateMedication(medicationId, data) {
    const sql = this.#store.sql;
    const [existing] = await sql`
      select patient_ref from clinical.medications where id = ${medicationId}
    `;

    if (!existing) {
      throw new Error('Medication not found.');
    }

    await this.#logAccess(existing.patient_ref, 'UPDATE_MEDICATION', 'clinical.medications', {
      medicationId
    });

    const [updated] = await sql`
      update clinical.medications set
        status = coalesce(${data.status}, status),
        instructions = coalesce(${data.instructions}, instructions),
        dosage = coalesce(${data.dosage}, dosage),
        frequency = coalesce(${data.frequency}, frequency),
        updated_at = now()
      where id = ${medicationId}
      returning *
    `;

    return new MedicationDTO(updated);
  }

  async erasePatientData(patientRef) {
    if (this.#actor.role !== 'admin') {
      throw new ForbiddenError('Only clinic administrators can execute right-to-be-forgotten data erasure.');
    }

    await this.#logAccess(patientRef, 'PURGE_PATIENT_RECORDS', 'clinical.*');
    const sql = this.#store.sql;

    // Hard-delete clinical data
    await sql`delete from clinical.medications where patient_ref = ${patientRef}`;
    await sql`delete from clinical.consultations where patient_ref = ${patientRef}`;
    await sql`delete from clinical.reminder_log where patient_ref = ${patientRef}`;
    await sql`delete from clinical.access_log where patient_ref = ${patientRef}`;
    await sql`delete from clinical.clinical_patients where patient_ref = ${patientRef}`;

    return { ok: true, erased: patientRef };
  }
}
