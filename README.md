# The Skin Tree: Single-Database Architecture & Deployment Guide

Luxury Aesthetic Clinic Booking, Admin Scheduling, and Confidential Medical Records System.  
**Lead Dermatologist:** Dr. Aishwarya Agarwal  
**Clinic Sanctuary:** Bandra West, Mumbai  

---

## Architecture Overview

The system runs on **ONE Supabase Project** (PostgreSQL in `ap-northeast-1`, project ref `lvixgaxgxjmuxsmggefe`) with Postgres-enforced schema separation:
- **`booking` schema:** Scheduling identity (contacts), time slots, bookings, blocks, staff roster, immutable audit log.
- **`clinical` schema:** Highly confidential medical charts, doctor consultations, prescriptions, access logs.

### Three Least-Privilege Postgres Roles
1. **`web_api`:** Used exclusively by the public client application (`client/`) and AI chatbot. Has `USAGE` on schema `booking`, **zero table privileges**, and execute privileges on only 5 public wrapper functions. It has zero access to the `clinical` schema.
2. **`admin_booking`:** Used by the admin portal (`admin/`) for all reception users and scheduling workflows. Has full DML on `booking` tables (except `DELETE` is blocked on `bookings` and `contacts`, and `audit_log` is append-only). Has zero access to the `clinical` schema.
3. **`admin_clinical`:** Used exclusively by licensed doctors and administrators on clinical routes. Gated behind an object-oriented access layer (`PatientRecordService`). Has DML on clinical tables and `SELECT`-only access on `booking` tables.

---

## 1. Supabase Setup (Single Project - `lvixgaxgxjmuxsmggefe`)

### A. Run Database Schemas & Function Definitions
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and navigate to your project.
2. Go to **SQL Editor** → **New query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql), copy its entire contents, paste it into the editor, and click **Run**.
4. This creates:
   - Schemas: `booking` and `clinical`
   - Three Postgres roles: `web_api`, `admin_booking`, `admin_clinical`
   - All tables, partial indexes, advisory locks, and atomic `SECURITY DEFINER` functions
   - Explicit grants, default privilege revocations, and Row Level Security (RLS) policies

### B. Set Strong Passwords for the Three Roles
In the **SQL Editor**, run (generate 32+ character random strings with `openssl rand -base64 32`):
```sql
alter role web_api with password '<GENERATE_WEB_API_PASSWORD>';
alter role admin_booking with password '<GENERATE_ADMIN_BOOKING_PASSWORD>';
alter role admin_clinical with password '<GENERATE_ADMIN_CLINICAL_PASSWORD>';
```

### C. Retrieve Pooled Connection Strings
1. In the Supabase Dashboard, click the green **Connect** button at the top header (or navigate to **Project Settings** → **Database**).
2. Select **Connection string** → **Transaction mode** (Port `6543`).
3. Construct your three connection strings using the username pattern `<role>.<project-ref>`:
   ```env
   # Public Web Client (role: web_api)
   WEB_DATABASE_URL="postgresql://web_api.lvixgaxgxjmuxsmggefe:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

   # Admin App Scheduling (role: admin_booking)
   ADMIN_BOOKING_DATABASE_URL="postgresql://admin_booking.lvixgaxgxjmuxsmggefe:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

   # Admin App Clinical Records (role: admin_clinical)
   ADMIN_CLINICAL_DATABASE_URL="postgresql://admin_clinical.lvixgaxgxjmuxsmggefe:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
   ```

### D. Secure Supabase Auth & Data API Settings
1. **Disable Public Sign-ups:** Navigate to **Authentication** → **Providers** → **Email** and uncheck *Allow new users to sign up*. Only staff invited by administrators may access the portal.
2. **Enable TOTP MFA:** Navigate to **Authentication** → **Multi-Factor** and enable *Time-based One-Time Password (TOTP)*.
3. **Keep Schemas Out of Data API:** Navigate to **Project Settings** → **API** → **Data API Settings**. Ensure only `public` (or none) is listed under *Exposed schemas*. **DO NOT** add `booking` or `clinical`.

---

## 2. Deploying to Vercel (Two Distinct Deployments)

The monorepo contains two separate Vercel deployments:
1. **Public Site (`client/`):**
   - Root Directory: `client`
   - Framework Preset: `Vite`
   - Include files outside the root directory: **Enabled** (for `@theskintree/shared`)
   - Environment Variables:
     - `WEB_DATABASE_URL`: `postgresql://web_api...`
     - `GEMINI_API_KEY`: Primary Google Gemini API key
     - `GEMINI_API_KEY_2`: Optional secondary Google Gemini API key (separate project for hedged fallback)
     - `CHAT_MODEL`: Pinned primary model (e.g. `gemini-3.1-flash-lite`)
     - `CHAT_MODEL_FALLBACK`: Pinned fallback model (e.g. `gemini-3.5-flash`)
     - `RESEND_API_KEY`: Resend API key
     - `CLINIC_EMAIL`: `appointments@theskintree.in`
     - `SITE_URL`: `https://theskintree.in`
     - `CRON_SECRET`: High-entropy cron secret
2. **Admin Portal (`admin/`):**
   - Root Directory: `admin`
   - Framework Preset: `Vite`
   - Include files outside the root directory: **Enabled** (for `@theskintree/shared`)
   - Environment Variables:
     - `ADMIN_BOOKING_DATABASE_URL`: `postgresql://admin_booking...`
     - `ADMIN_CLINICAL_DATABASE_URL`: `postgresql://admin_clinical...`
     - `SUPABASE_URL` / `VITE_SUPABASE_URL`: `https://lvixgaxgxjmuxsmggefe.supabase.co`
     - `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`: Supabase anon/publishable key
     - `RESEND_API_KEY`: Resend API key
     - `CLINIC_EMAIL`: `concierge@theskintree.in`
     - `SITE_URL`: `https://theskintree.in`
     - `CRON_SECRET`: High-entropy cron secret

---

## 3. Operational & Verification Commands

```bash
# 1. Run automated boundary and isolation security checks
npm run check:isolation

# 2. Run OOP clinical access layer unit tests
npm run test:unit

# 3. Build both client and admin applications
npm run build

# 4. Bootstrap the initial clinic administrator
node scripts/create-first-admin.mjs admin@theskintree.in "YourStrongPassword123!" "Dr. Aishwarya Agarwal"

# 5. Run database privilege assertions across all 3 roles
npm run test:privilege

# 6. Run concurrency race-test (10 simultaneous booking attempts)
npm run test:race

# 7. Seed demo data (Development only; refused in production)
npm run seed
```
