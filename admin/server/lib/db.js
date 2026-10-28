/**
 * Admin Database Layer (Single Database, Role-Segregated Connections)
 * Hard Rule 5: Server-side authorization & connection selection in ONE place.
 * getDbFor(actor).booking(): always returns admin_booking connection.
 * getDbFor(actor).clinical(): throws ForbiddenError unless actor.role is doctor or admin.
 */

import postgres from 'postgres';
import { ForbiddenError } from './errors.js';
import { getClinicalConnection } from '../clinical/connection.js';

let bookingSql = null;

function getAdminBookingSql() {
  if (bookingSql) return bookingSql;

  const connStr = process.env.ADMIN_BOOKING_DATABASE_URL;
  if (!connStr) {
    throw new Error('ADMIN_BOOKING_DATABASE_URL is not configured.');
  }

  bookingSql = postgres(connStr, {
    prepare: false,
    max: 1,
    ssl: 'require',
    idle_timeout: 20,
    connect_timeout: 10
  });

  return bookingSql;
}

/**
 * Connection selector based on authenticated staff actor.
 * @param {Object} actor - Authenticated staff actor { user_id, role, name }
 */
export function getDbFor(actor) {
  return {
    booking() {
      return getAdminBookingSql();
    },
    clinical() {
      if (!actor || actor.role !== 'doctor') {
        throw new ForbiddenError(
          `Forbidden: Staff role '${actor?.role || 'anonymous'}' is not authorized to access the clinical database connection. Clinical records are restricted exclusively to medical doctors.`
        );
      }
      return getClinicalConnection();
    }
  };
}

/**
 * Log entry into booking.audit_log (append-only)
 */
export async function logBookingAudit({ staffId, action, targetType, targetId, details = {} }) {
  try {
    const sql = getAdminBookingSql();
    await sql`
      insert into booking.audit_log (staff_id, action, target_type, target_id, details)
      values (
        ${staffId || null},
        ${action},
        ${targetType || null},
        ${targetId ? String(targetId) : null},
        ${sql.json(details)}
      )
    `;
  } catch (err) {
    console.error('[BookingAuditLog Error]:', err.message);
  }
}
