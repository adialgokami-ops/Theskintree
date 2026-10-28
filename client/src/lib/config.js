/**
 * client/src/lib/config.js
 * Configuration helpers for client application.
 */

let loggedWarning = false;

export function getClinicWhatsApp() {
  const number =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLINIC_WHATSAPP) ||
    (typeof process !== 'undefined' && process.env?.CLINIC_WHATSAPP) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.CLINIC_WHATSAPP) ||
    '';

  if (!number && !loggedWarning) {
    console.error('🚨 [CRITICAL CONFIG WARNING] CLINIC_WHATSAPP environment variable is not configured! WhatsApp contact features will be disabled or degraded.');
    loggedWarning = true;
  }

  return number;
}

export default { getClinicWhatsApp };
