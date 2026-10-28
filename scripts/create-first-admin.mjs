#!/usr/bin/env node
/**
 * scripts/create-first-admin.mjs
 * Bootstrap initial clinic administrator account.
 * Step 4: Auth user created via Supabase Auth Admin/Anon API; staff row inserted via admin_booking database connection.
 * Usage: node scripts/create-first-admin.mjs [email] [password] [name]
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Load env
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'admin/.env.local'),
  path.resolve(process.cwd(), 'admin/.env')
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

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const adminBookingUrl = process.env.ADMIN_BOOKING_DATABASE_URL;

if (!adminBookingUrl) {
  console.error('❌ Error: ADMIN_BOOKING_DATABASE_URL must be set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const adminEmail = args[0] || 'admin@theskintree.in';
const adminPassword = args[1] || 'SkinTree@Secure2026!';
const adminName = args[2] || 'Dr. Aishwarya Agarwal (Administrator)';

async function main() {
  console.log(`🌿 Bootstrapping initial admin account for: ${adminEmail}`);

  let userId = null;

  // 1. Create or retrieve user via Supabase Auth Admin REST API
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && secretKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': secretKey,
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { name: adminName }
        })
      });

      const body = await res.json();
      if (res.ok && body?.id) {
        userId = body.id;
        console.log(`✅ Supabase Auth user created with ID: ${userId}`);
      } else if (body?.msg?.includes('already been registered') || body?.message?.includes('already registered')) {
        // Find existing user
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
          headers: {
            'apikey': secretKey,
            'Authorization': `Bearer ${secretKey}`
          }
        });
        const listData = await listRes.json();
        const existing = listData?.users?.find(u => u.email === adminEmail);
        if (existing) {
          userId = existing.id;
          console.log(`ℹ️ User already registered in Auth with ID: ${userId}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Supabase Auth API call failed:', e.message);
    }
  }

  // Fallback to client signup if secret key not present
  if (!userId && supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          data: { name: adminName }
        })
      });
      const data = await res.json();
      if (data?.id || data?.user?.id) {
        userId = data.id || data.user.id;
        console.log(`✅ Supabase Auth user registered with ID: ${userId}`);
      }
    } catch (_) {}
  }

  // 2. Connect via admin_booking role
  const sql = postgres(adminBookingUrl, { prepare: false, max: 1, ssl: 'require' });

  try {
    if (!userId) {
      // Check if user exists in auth.users or create random UUID
      const [existingStaff] = await sql`
        select user_id from booking.staff where name = ${adminName} limit 1
      `;
      userId = existingStaff?.user_id || crypto.randomUUID();
    }

    // Upsert staff table row
    const [staff] = await sql`
      insert into booking.staff (user_id, name, role, active)
      values (${userId}, ${adminName}, 'admin', true)
      on conflict (user_id) do update set
        role = 'admin',
        active = true,
        name = ${adminName}
      returning *
    `;

    console.log('✅ Staff record created/updated successfully in booking.staff:');
    console.log(`   User ID: ${staff.user_id}`);
    console.log(`   Role:    ${staff.role}`);
    console.log(`   Active:  ${staff.active}`);

    console.log('\n======================================================');
    console.log('🎉 First Admin Account Ready!');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Role:     admin`);
    console.log('======================================================\n');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
