/**
 * Public API Validation Bridge
 * Imports pure validation logic from shared workspace.
 */

import {
  normalisePhone,
  validateName,
  validateEmail,
  validateDate,
  validateTime,
  validateNotes,
  validateBookingInput,
  ERROR_MESSAGES,
  TREATMENTS
} from '../../../../shared/index.js';

export {
  normalisePhone,
  validateName,
  validateEmail,
  validateDate,
  validateTime,
  validateNotes,
  validateBookingInput,
  ERROR_MESSAGES,
  TREATMENTS
};
