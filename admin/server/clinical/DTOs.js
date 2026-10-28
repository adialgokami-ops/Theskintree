/**
 * Allow-listed Data Transfer Objects (DTOs) for Clinical Records
 * Ensures raw database columns and internal metadata are never leaked.
 */

export class PatientProfileDTO {
  constructor(row) {
    this.patient_ref = row.patient_ref;
    this.skin_type = row.skin_type || null;
    this.allergies = row.allergies || null;
    this.medical_history = row.medical_history || null;
    this.emergency_contact = row.emergency_contact || null;
    this.notes = row.notes || null;
    this.date_of_birth = row.date_of_birth || null;
    this.gender = row.gender || 'unspecified';
  }
}

export class ConsultationDTO {
  constructor(row) {
    this.id = row.id;
    this.patient_ref = row.patient_ref;
    this.doctor_id = row.doctor_id || null;
    this.consultation_date = row.consultation_date instanceof Date
      ? row.consultation_date.toISOString().split('T')[0]
      : String(row.consultation_date);
    this.chief_complaint = row.chief_complaint;
    this.examination_findings = row.examination_findings || null;
    this.diagnosis = row.diagnosis || null;
    this.clinical_notes = row.clinical_notes || null;
    this.plan = row.plan || null;
    this.follow_up_date = row.follow_up_date
      ? (row.follow_up_date instanceof Date
          ? row.follow_up_date.toISOString().split('T')[0]
          : String(row.follow_up_date))
      : null;
  }
}

export class MedicationDTO {
  constructor(row) {
    this.id = row.id;
    this.patient_ref = row.patient_ref;
    this.consultation_id = row.consultation_id || null;
    this.prescribed_by = row.prescribed_by || null;
    this.name = row.name;
    this.dosage = row.dosage;
    this.frequency = row.frequency;
    this.duration_days = row.duration_days || null;
    this.instructions = row.instructions || null;
    this.start_date = row.start_date instanceof Date
      ? row.start_date.toISOString().split('T')[0]
      : String(row.start_date);
    this.status = row.status || 'active';
  }
}

export class ReminderDTO {
  constructor({ patient_ref, name, phone, kind, dueDate }) {
    this.patient_ref = patient_ref;
    this.name = name || 'Valued Patient';
    this.phone = phone || '';
    this.kind = kind; // 'appointment' | 'followup' | 'medication'
    this.dueDate = dueDate || null;
  }
}
