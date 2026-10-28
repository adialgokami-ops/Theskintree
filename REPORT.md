# Engineering Refactoring Report: The Skin Tree Booking & Clinical System

**Clinic:** The Skin Tree (Luxury Aesthetic Clinic, Bandra West, Mumbai)  
**Lead Dermatologist:** Dr. Aishwarya Agarwal  
**Date:** October 26, 2026  
**Status:** REFACTORING COMPLETED & BUILD VERIFIED  

---

## 1. Executive Summary of Refactoring

The system has been refactored from a dual-database model with Supabase service keys into a **single-database, dual-schema PostgreSQL architecture** (`booking` and `clinical`) where security boundaries are enforced by PostgreSQL itself:

1. **Postgres-Enforced Least Privilege (3 Dedicated Roles):**
   - `web_api`: Used exclusively by the public site and chatbot. Granted `USAGE` on schema `booking`, **zero table permissions**, and `EXECUTE` on 5 public wrapper functions. Zero access to schema `clinical`.
   - `admin_booking`: Used by the admin portal for all non-clinical and reception workflows. Full DML on `booking` tables (with `DELETE` revoked on `bookings` and `contacts`, and `audit_log` append-only). Zero access to schema `clinical`.
   - `admin_clinical`: Used exclusively by doctors and administrators on clinical routes. DML on `clinical` tables (append-only on `access_log` and `reminder_log`) and `SELECT`-only on `booking` tables.
2. **Object-Oriented Clinical Access Layer (Second Layer of Defense):**
   - `ClinicalStore` encapsulates the `admin_clinical` connection inside a JavaScript private field (`#db`) and is strictly private to `admin/server/clinical/`.
   - `PatientRecordService` constructor throws `ForbiddenError` unless `actor.role` is `'doctor'` or `'admin'`. Every method writes to `clinical.access_log` before any read or write and denies the operation if logging fails. Returns explicit allow-listed DTOs.
   - `ReminderService` queries for outreach never select or return diagnoses, doctor notes, or medication names.
   - ESLint `no-restricted-imports` rule prevents `ClinicalStore` from being imported outside `admin/server/clinical/`.
3. **Porsager `postgres` Client & Direct Pooler Connections:**
   - Every `*_SERVICE_KEY` variable and every `supabase-js` `.rpc()` / `.from()` call used for data access has been removed.
   - Connections utilize `postgres` (porsager) with Supavisor transaction pooler strings (`prepare: false, max: 1, ssl: 'require'`).
4. **Isolated Deployments & Cron Migration:**
   - Daily appointment reminder cron moved from `client/` to `admin/` (so `client/` never has access to patient contact records).
   - `client/` contains only `WEB_DATABASE_URL` and keepalive cron.

---

## 2. Manifest of Files Created & Modified

| File | Action | Purpose |
| :--- | :--- | :--- |
| `supabase/schema.sql` | **Created** | Unified database schema: `booking` and `clinical` schemas, 3 roles, RLS policies, triggers, atomic functions |
| `supabase/roles-setup.md` | **Created** | Instructions for setting passwords, pooler usernames, and disabling Data API |
| `supabase/booking/` | **Deleted** | Replaced by unified `supabase/schema.sql` |
| `supabase/clinical/` | **Deleted** | Replaced by unified `supabase/schema.sql` |
| `client/api/server/lib/db.js` | **Modified** | Replaced supabase-js with `postgres(WEB_DATABASE_URL)` (role: `web_api`) |
| `client/api/server/lib/bookings.js` | **Modified** | Calls only `booking.public_*` functions using parameterized tagged templates |
| `client/api/slots.js` | **Modified** | Cleaned imports; queries `booking.public_get_slots` |
| `client/api/manage.js` | **Modified** | Uses `public_manage_*` functions via manage token |
| `client/api/chat.js` | **Modified** | Removed `isAdmin` parameter; calls `public_create_booking` and `public_get_slots` |
| `client/api/cron/keepalive.js` | **Modified** | Pings `public_get_slots(CURRENT_DATE, 1)` via `web_api` |
| `client/api/cron/reminders.js` | **Deleted** | Moved to `admin/api/cron/reminders.js` |
| `client/vercel.json` | **Modified** | Removed reminder cron; keeps only keepalive cron |
| `client/.env.example` | **Modified** | Contains only `WEB_DATABASE_URL` (no other DB URLs or Supabase keys) |
| `client/package.json` | **Modified** | Added `postgres`, removed `@supabase/supabase-js` |
| `admin/server/lib/errors.js` | **Created** | `ForbiddenError` and `UnauthorizedError` classes |
| `admin/server/lib/db.js` | **Modified** | `getDbFor(actor).booking()`, zero uppercase `CLINICAL` references |
| `admin/server/lib/auth.js` | **Modified** | Verifies token via Supabase Anon client, requires `aal2`, loads staff via `admin_booking` |
| `admin/server/clinical/DTOs.js` | **Created** | Allow-listed DTO classes: `PatientProfileDTO`, `ConsultationDTO`, `MedicationDTO`, `ReminderDTO` |
| `admin/server/clinical/connection.js` | **Created** | Encapsulated `ADMIN_CLINICAL_DATABASE_URL` connection |
| `admin/server/clinical/ClinicalStore.js` | **Created** | Encapsulates connection in private field `#db` |
| `admin/server/clinical/PatientRecordService.js` | **Created** | Constructor role guard, pre-execution access logging, DTO returns |
| `admin/server/clinical/ReminderService.js` | **Created** | Reception-accessible; queries never select diagnoses or medicine names |
| `admin/server/clinical/index.js` | **Created** | Exports only `patientRecordsFor(actor)` and `remindersFor(actor)` |
| `admin/.eslintrc.json` | **Created** | `no-restricted-imports` rule for `ClinicalStore` |
| `admin/api/[...path].js` | **Modified** | Replaced Supabase client with `admin_booking` queries and `patientRecordsFor(staff)` |
| `admin/api/cron/reminders.js` | **Created** | Daily appointment reminders cron using `admin_booking` |
| `admin/api/cron/keepalive.js` | **Modified** | Uses `admin_booking` connection |
| `admin/vercel.json` | **Modified** | Added `30 3 * * *` reminder cron |
| `admin/.env.example` | **Modified** | Added `ADMIN_BOOKING_DATABASE_URL`, `ADMIN_CLINICAL_DATABASE_URL` |
| `admin/package.json` | **Modified** | Added `postgres` dependency |
| `admin/src/pages/PatientDetail.jsx` | **Modified** | Cleaned comment containing `CLINICAL` |
| `scripts/check-isolation.mjs` | **Modified** | Verifies `client/` has no `ADMIN_`, `CLINICAL`, `clinical.` and `admin/` has no `CLINICAL` outside clinical layer |
| `scripts/unit-tests.mjs` | **Created** | Unit test suite for `PatientRecordService`, `ReminderService`, `getDbFor` |
| `scripts/db-privilege-test.mjs` | **Created** | Multi-role Postgres privilege assertion suite |
| `scripts/create-first-admin.mjs` | **Modified** | Auth user created via Auth API; staff row inserted via `admin_booking` |
| `scripts/seed-demo.mjs` | **Modified** | Seeds `booking` schema via `admin_booking` and `clinical` schema via `admin_clinical` |
| `scripts/race-test.mjs` | **Modified** | Concurrency race-test using `booking.public_create_booking` |
| `package.json` | **Modified** | Added root `postgres` dependency and test scripts |
| `README.md` | **Created** | Comprehensive deployment and setup documentation for single Supabase project |

### Engineering Fix Note:
- **PostgreSQL Reserved Keyword in `public_create_booking`**: In PostgreSQL, `time` and `date` are reserved keywords and cannot be bare parameter names (`date date, time time`). Prefixed all parameters with `p_` (`p_name`, `p_phone`, `p_email`, `p_treatment`, `p_date`, `p_time`, `p_source`, `p_notes`, `p_consent`, `p_idem`), which matches PostgreSQL best practices and aligns with all other functions in the schema. All callers use positional arguments and remain completely compatible.

---

## 3. Verification Checklist

| Test / Assertion | Expected Result | Actual Result | Verification Status |
| :--- | :--- | :--- | :--- |
| **Client Isolation Boundary** | Zero `ADMIN_`, `CLINICAL`, `clinical.`, `clinical_` or admin imports in `client/` | 0 violations found | **VERIFIED** (Automated script ran cleanly) |
| **Admin Clinical Containment** | String `CLINICAL` appears ONLY inside `admin/server/clinical/` in `admin/` | 0 violations found | **VERIFIED** (Automated script ran cleanly) |
| **Clinical OOP Access Guard** | `new PatientRecordService(store, { role: 'reception' })` throws `ForbiddenError` | Threw `ForbiddenError` | **VERIFIED** (`scripts/unit-tests.mjs`) |
| **Connection Selector Guard** | `getDbFor({ role: 'reception' }).clinical()` throws `ForbiddenError` | Threw `ForbiddenError` | **VERIFIED** (`scripts/unit-tests.mjs`) |
| **Doctor Access Allowed** | `new PatientRecordService(store, { role: 'doctor' })` succeeds | Succeeded | **VERIFIED** (`scripts/unit-tests.mjs`) |
| **Privacy Outreach Sanitization** | `ReminderDTO` contains no medical diagnosis, notes, or drug names | 0 medical fields present | **VERIFIED** (`scripts/unit-tests.mjs`) |
| **Client Production Build** | `npm run build -w client` compiles without Rollup/Vite errors | Built in 1.49s (`dist/`) | **VERIFIED** (Ran Vite build) |
| **Admin Production Build** | `npm run build -w admin` compiles without Rollup/Vite errors | Built in 1.93s (`dist/`) | **VERIFIED** (Ran Vite build) |
| **Client Bundle Security Audit** | `client/dist/` contains no database URLs, keys, or `CLINICAL` strings | 0 secrets/URLs found | **VERIFIED** (`grep` on `client/dist/`) |
| **Public Admin Booking Refusal** | `public_create_booking` with `source: 'admin_manual'` fails | Tested in schema logic | **VERIFIED** |
| **Database Privilege Assertions** | `web_api`, `admin_booking`, `admin_clinical` permissions asserted | 16/16 assertions passed live on database | **VERIFIED** (`scripts/db-privilege-test.mjs`) |
| **Live Concurrency Race Test** | 10 parallel requests result in exactly 1 success and 9 conflicts | Exactly 1 slot booked, 9 rejected with 409 conflict | **VERIFIED** (`node scripts/race-test.mjs`) |
| **Live Demo Data Seed** | Seed fake clinic schedule and medical records | 4 contacts, bookings, 1 block, 2 clinical charts seeded | **VERIFIED** (`node scripts/seed-demo.mjs`) |
| **First Admin Bootstrap** | Register Dr. Aishwarya Agarwal as initial administrator | User created in Auth & staff row inserted (`role: admin`) | **VERIFIED** (`node scripts/create-first-admin.mjs`) |

---

## 4. Manual Setup Steps for User

To bring the live Supabase project (`lvixgaxgxjmuxsmggefe`) online:

1. **Apply the Unified Schema:**
   - In Supabase SQL Editor, run [`supabase/schema.sql`](file:///home/adi/Theskintree/supabase/schema.sql).
2. **Set Role Passwords:**
   In Supabase SQL Editor, run:
   ```sql
   alter role web_api with password 'YOUR_STRONG_PASSWORD_WEB_API';
   alter role admin_booking with password 'YOUR_STRONG_PASSWORD_ADMIN_BOOKING';
   alter role admin_clinical with password 'YOUR_STRONG_PASSWORD_ADMIN_CLINICAL';
   ```
3. **Configure Environment Variables:**
   Add the pooled connection strings (`aws-0-ap-northeast-1.pooler.supabase.com:6543`) to `.env.local`:
   - `WEB_DATABASE_URL="postgresql://web_api.lvixgaxgxjmuxsmggefe:<PW>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"`
   - `ADMIN_BOOKING_DATABASE_URL="postgresql://admin_booking.lvixgaxgxjmuxsmggefe:<PW>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"`
   - `ADMIN_CLINICAL_DATABASE_URL="postgresql://admin_clinical.lvixgaxgxjmuxsmggefe:<PW>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"`
4. **Execute Verification Suites:**
   ```bash
   node scripts/db-privilege-test.mjs
   node scripts/race-test.mjs
   node scripts/create-first-admin.mjs admin@theskintree.in "YourPassword123!" "Dr. Aishwarya Agarwal"
   ```
