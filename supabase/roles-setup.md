# Supabase Role Setup & Security Configuration

The Skin Tree database architecture separates all clinic data into two Postgres schemas:
- `booking`: scheduling, contacts, slots, blocks, staff, audit logs
- `clinical`: confidential patient charts, medical notes, prescriptions, access logs

Access is governed at the PostgreSQL engine level via three dedicated database roles with least privilege.

---

## 1. Apply Schema and Roles
In your Supabase project dashboard:
1. Navigate to **SQL Editor** → **New Query**.
2. Open [`supabase/schema.sql`](./schema.sql), paste the entire script, and click **Run**.
3. This creates:
   - The `booking` and `clinical` schemas.
   - The three Postgres roles: `web_api`, `admin_booking`, and `admin_clinical`.
   - All tables, indexes, triggers, and atomic functions.
   - Role privileges, grants, and Row Level Security (RLS) policies.

---

## 2. Set Strong, Unique Passwords for the Three Roles
In the **SQL Editor**, run the following commands, replacing each placeholder with a strong, distinct secret password:

```sql
-- Role 1: Used ONLY by public site and chatbot (client/)
alter role web_api with password 'REPLACE_WITH_STRONG_PASSWORD_WEB_API';

-- Role 2: Used by admin portal for scheduling and reception (admin/)
alter role admin_booking with password 'REPLACE_WITH_STRONG_PASSWORD_ADMIN_BOOKING';

-- Role 3: Used by admin portal ONLY for doctors accessing clinical charts
alter role admin_clinical with password 'REPLACE_WITH_STRONG_PASSWORD_ADMIN_CLINICAL';
```

---

## 3. Retrieve Your Supabase Pooled Connection Strings
Supabase uses Supavisor as its connection pooler (Transaction mode, port `6543`).
To get your pooled connection string:
1. Go to **Project Settings** → **Database** (or click the green **Connect** button at the top header).
2. Look for **Connection string** → Select **Transaction mode** (Port `6543`).
3. The host format is:
   `aws-0-[region].pooler.supabase.com:6543/postgres`
4. The username format for custom roles in Supabase is `<role>.<project-ref>`.

Construct your three environment variables as follows (URL-encode special characters in passwords):

```env
# Public client (client/.env.local)
WEB_DATABASE_URL="postgresql://web_api.lvixgaxgxjmuxsmggefe:YOUR_WEB_API_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

# Admin app (admin/.env.local)
ADMIN_BOOKING_DATABASE_URL="postgresql://admin_booking.lvixgaxgxjmuxsmggefe:YOUR_ADMIN_BOOKING_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
ADMIN_CLINICAL_DATABASE_URL="postgresql://admin_clinical.lvixgaxgxjmuxsmggefe:YOUR_ADMIN_CLINICAL_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

---

## 4. Keep `booking` and `clinical` Out of Supabase Data API
To guarantee that the public PostgREST Data API never exposes either schema:
1. In the Supabase Dashboard, go to **Project Settings** → **API**.
2. Under **Data API Settings** → **Exposed Schemas**:
   - Ensure only `public` (or nothing) is listed.
   - **DO NOT** add `booking` or `clinical` to the exposed schemas list.
3. Because all permissions have been explicitly revoked from `anon`, `authenticated`, and `public`, external HTTP requests directly to the Supabase REST endpoint cannot access any tables or functions.

---

## 5. Verify Permissions
Run the automated privilege test script to verify that Postgres permission barriers are working:
```bash
node scripts/db-privilege-test.mjs
```
