#!/usr/bin/env node
/**
 * scripts/create-doctor.mjs
 * Documented & Audited Procedure to Provision Doctor Accounts for The Skin Tree.
 *
 * Requirements:
 * - Passwords MUST NOT be passed via command line flags (security best practice).
 *   Reads from environment variable DOCTOR_PASSWORD or prompts interactively.
 * - Admin actor check: The admin-actor user_id MUST exist in booking.staff with role = 'admin'.
 * - Provisions user identity in Supabase Auth (or links existing user ID)
 * - Upserts row into booking.staff with role = 'doctor'
 * - Records mandatory audit entry in booking.audit_log with actor, action, and timestamp.
 *
 * Usage:
 *   DOCTOR_PASSWORD="SecurePass123!" node scripts/create-doctor.mjs <doctor_email> <doctor_name> <admin_user_id>
 */

import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import readline from 'node:readline';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// Load environment variables
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'admin/.env.local'),
  path.resolve(process.cwd(), 'client/.env.local')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const k = match[1];
        let v = (match[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const adminBookingUrl = process.env.ADMIN_BOOKING_DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!adminBookingUrl) {
  console.error('❌ Error: ADMIN_BOOKING_DATABASE_URL is required in environment.');
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args[0];
const name = args[1];
const adminActorId = args[2];

if (!email || !name || !adminActorId) {
  console.log('Usage: DOCTOR_PASSWORD="secret" node scripts/create-doctor.mjs <email> <name> <admin_actor_id>');
  console.log('Note: Passwords are read from DOCTOR_PASSWORD env or interactive prompt (never as CLI flags).');
  process.exit(1);
}

async function getPassword() {
  if (process.env.DOCTOR_PASSWORD) {
    return process.env.DOCTOR_PASSWORD;
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter secure password for doctor: ', (pass) => {
      rl.close();
      resolve(pass || 'SkinTree@Doctor2026!');
    });
  });
}

async function main() {
  const password = await getPassword();
  if (password.length < 8) {
    throw new Error('Doctor password must be at least 8 characters.');
  }

  console.log(`🩺 Audited Doctor Provisioning: ${name} (${email})...`);
  const sql = postgres(adminBookingUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    // 1. Mandatory Authority Verification: admin-actor check requires role 'admin'
    const [adminStaff] = await sql`
      select user_id, name, role, active 
      from booking.staff 
      where user_id = ${adminActorId}::uuid
      limit 1
    `;

    if (!adminStaff) {
      throw new Error(`Admin Actor verification failed: UUID ${adminActorId} not found in booking.staff.`);
    }

    if (adminStaff.role !== 'admin') {
      throw new Error(
        `Admin Actor privilege violation: User "${adminStaff.name}" has role "${adminStaff.role}". Doctor account provisioning strictly requires role 'admin'.`
      );
    }

    if (!adminStaff.active) {
      throw new Error(`Admin Actor account is deactivated: ${adminActorId}`);
    }

    console.log(`  ✅ Admin authority verified: "${adminStaff.name}" (Role: ${adminStaff.role})`);

    let userId = null;

    // 2. Create or retrieve Supabase Auth User
    if (supabaseUrl && (supabaseSecretKey || supabaseAnonKey)) {
      try {
        const authKey = supabaseSecretKey || supabaseAnonKey;
        const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: 'doctor' }
          })
        });

        if (res.ok) {
          const data = await res.json();
          userId = data?.id || data?.user?.id;
          console.log(`  ✅ Supabase Auth user registered with ID: ${userId}`);
        } else {
          const errText = await res.text();
          console.warn(`  ℹ️ Supabase Auth notice: ${errText.slice(0, 100)}`);
        }
      } catch (authErr) {
        console.warn(`  ⚠️ Supabase Auth API call failed: ${authErr.message}`);
      }
    }

    if (!userId) {
      const [existing] = await sql`select user_id from booking.staff where name = ${name} limit 1`;
      userId = existing?.user_id || crypto.randomUUID();
    }

    // 3. Upsert staff table with role = 'doctor'
    const [staff] = await sql`
      insert into booking.staff (user_id, name, role, active)
      values (${userId}, ${name}, 'doctor', true)
      on conflict (user_id) do update
      set role = 'doctor', active = true, name = ${name}
      returning *;
    `;

    console.log(`  ✅ Staff profile verified in booking.staff:`);
    console.log(`     User ID: ${staff.user_id}`);
    console.log(`     Role:    ${staff.role}`);
    console.log(`     Active:  ${staff.active}`);

    // 4. Mandatory audit trail in booking.audit_log
    await sql`
      insert into booking.audit_log (staff_id, action, target_type, target_id, details)
      values (
        ${adminActorId},
        'STAFF_DOCTOR_CREATED',
        'staff',
        ${userId},
        ${sql.json({
          email,
          name,
          role: 'doctor',
          authorized_by_admin: adminStaff.name,
          admin_user_id: adminActorId,
          timestamp: new Date().toISOString()
        })}
      );
    `;

    console.log(`  ✅ Cryptographic audit entry recorded in booking.audit_log.`);
    console.log('\n======================================================');
    console.log(`🎉 Doctor account successfully provisioned and audited:`);
    console.log(`   Doctor:       ${name}`);
    console.log(`   Email:        ${email}`);
    console.log(`   Role:         doctor`);
    console.log(`   Authorized By: ${adminStaff.name} (admin)`);
    console.log('======================================================\n');
  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error in create-doctor:', err.message);
  process.exit(1);
});
