/**
 * Shared constants for The Skin Tree
 * Doctor: Dr. Aishwarya Agarwal
 */

export const CLINIC_NAME = 'The Skin Tree';
export const CLINIC_DOCTOR = 'Dr. Aishwarya Agarwal';
export const CLINIC_TIMEZONE = 'Asia/Kolkata';

export const TREATMENTS = [
  { slug: 'botox', name: 'Botulinum Toxin (Botox®)' },
  { slug: 'fillers', name: 'Dermal Fillers (Hyaluronic Acid)' },
  { slug: 'hydrafacial', name: 'Medical HydraFacial' },
  { slug: 'laser', name: 'Fractional Laser Resurfacing' },
  { slug: 'peels', name: 'Chemical Peels' },
  { slug: 'acne', name: 'Acne & Acne-Scarring Treatments' },
  { slug: 'consult', name: 'Consultation' }
];

export const TREATMENT_NAMES = TREATMENTS.map(t => t.name);

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
];

export const BOOKING_SOURCES = [
  'website_form',
  'ai_chat',
  'admin_manual'
];

export const STAFF_ROLES = [
  'admin',
  'doctor',
  'reception'
];

export const ERROR_MESSAGES = {
  consent_required: 'Consent to our privacy notice is required before booking.',
  slot_not_offered: 'The selected time slot is not offered on this day.',
  in_the_past: 'The requested appointment time is in the past.',
  out_of_window: 'Appointments must be scheduled between 12 hours and 60 days in advance.',
  slot_blocked: 'This consultation slot has been reserved or blocked by the clinic.',
  too_many_active: 'A maximum of 2 active bookings are permitted per contact number.',
  slot_taken: 'This slot was just booked by another client. Please select another time.',
  not_found: 'Appointment record not found.',
  not_active: 'This booking is no longer active and cannot be modified.',
  too_late_to_change: 'Changes cannot be made within 2 hours of the appointment time. Please call the clinic directly at +91 98765 43210.',
  mfa_required: 'Two-factor authentication (MFA) verification is required.',
  forbidden: 'You do not have permission to perform this action.',
  unauthorized: 'Authentication required. Please log in.',
  rate_limited: 'Too many requests. Please wait a moment before trying again.',
  generic: 'An unexpected issue occurred. Please try again or contact the clinic concierge.'
};
