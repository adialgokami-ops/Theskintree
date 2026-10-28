/**
 * Admin Server Authorization Middleware
 * Verifies Bearer token with Supabase Auth Anon client,
 * enforces MFA (aal2), then loads staff row via admin_booking database connection.
 */

import { getDbFor } from './db.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function verifySupabaseUser(token) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured.');
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      return { user: null, error: 'Invalid or expired authentication session.' };
    }

    const user = await res.json();
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err.message };
  }
}

function parseJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (_) {
    return null;
  }
}

/**
 * Require valid authenticated staff member with specific roles.
 * @param {Request} req - HTTP request
 * @param {string[]} [allowedRoles] - Optional allowed roles: ['admin', 'doctor', 'reception']
 * @returns {Promise<{ user: Object, staff: Object }>}
 */
export async function requireStaff(req, allowedRoles = null) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header.');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError('Empty Bearer token.');
  }

  // 1. Verify user with Supabase Auth
  const { user, error: authError } = await verifySupabaseUser(token);
  if (authError || !user) {
    throw new UnauthorizedError('Invalid or expired authentication session.');
  }

  // 2. Verify MFA level (aal2)
  const payload = parseJwtPayload(token);
  const aal = payload?.aal;
  const amr = payload?.amr || [];
  const hasTotpFactor = user.factors && user.factors.some(f => f.factor_type === 'totp' && f.status === 'verified');

  if (hasTotpFactor && aal !== 'aal2' && !amr.some(entry => entry.method === 'totp')) {
    const err = new UnauthorizedError('MFA verification required (aal2). Please verify TOTP.');
    err.code = 'MFA_REQUIRED';
    throw err;
  }

  // 3. Query booking.staff table via admin_booking connection
  const sql = getDbFor({ role: 'reception' }).booking();
  const [staff] = await sql`
    select user_id, name, role, active, created_at
    from booking.staff
    where user_id = ${user.id}
  `;

  if (!staff) {
    throw new ForbiddenError('Staff record not found for this authenticated user.');
  }

  if (!staff.active) {
    throw new ForbiddenError('Staff account has been deactivated.');
  }

  // 4. Role Authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(staff.role)) {
      throw new ForbiddenError(`Forbidden: Role '${staff.role}' lacks permission for this action.`);
    }
  }

  return { user, staff };
}
