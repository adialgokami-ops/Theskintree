/**
 * Shared input validators and phone normaliser for The Skin Tree
 */

const PHONE_REGEX = /^\+[0-9]{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Normalises phone numbers to E.164 (+<country><digits>)
 * Defaults 10-digit Indian numbers to +91.
 */
export function normalisePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    const digitsOnly = '+' + cleaned.replace(/[^\d]/g, '');
    return PHONE_REGEX.test(digitsOnly) ? digitsOnly : '';
  }

  // Handle leading 0 (common in India, e.g. 09876543210)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    const candidate = '+91' + cleaned.slice(1);
    return PHONE_REGEX.test(candidate) ? candidate : '';
  }

  // 10-digit Indian local number
  if (/^\d{10}$/.test(cleaned)) {
    return '+91' + cleaned;
  }

  // 12-digit starting with 91
  if (/^91\d{10}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Any raw digits that match 10-15 digits
  if (/^\d{10,15}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  return '';
}

export function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function validateEmail(email) {
  if (!email) return true; // Optional
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function validateDate(date) {
  if (!date || typeof date !== 'string') return false;
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return !isNaN(parsed.getTime());
}

export function validateTime(time) {
  if (!time || typeof time !== 'string') return false;
  return TIME_REGEX.test(time);
}

export function validateNotes(notes) {
  if (!notes) return true; // Optional
  if (typeof notes !== 'string') return false;
  return notes.length <= 500;
}

export function validateBookingInput(data = {}) {
  const errors = {};

  if (!validateName(data.name)) {
    errors.name = 'Full name must be between 2 and 80 characters.';
  }

  const phone = normalisePhone(data.phone);
  if (!phone) {
    errors.phone = 'Valid 10 to 15 digit contact phone number is required.';
  }

  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (!data.treatment || typeof data.treatment !== 'string' || !data.treatment.trim()) {
    errors.treatment = 'Please specify the consultation reason or treatment.';
  }

  if (!validateDate(data.date)) {
    errors.date = 'Appointment date must be formatted as YYYY-MM-DD.';
  }

  if (!validateTime(data.time)) {
    errors.time = 'Appointment time must be formatted as HH:MM.';
  }

  if (data.notes && !validateNotes(data.notes)) {
    errors.notes = 'Notes cannot exceed 500 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalisedPhone: phone
  };
}
