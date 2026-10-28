# Admin Portal Deployment Checklist (Vercel)

**Project:** The Skin Tree Admin Portal  
**Document:** Deployment & Operational Checklist  
**Security Rule:** Never include secrets, bypass tokens, or credentials in this document or git history.

---

## 1. Project Configuration in Vercel

The Admin Portal must be deployed as an **independent Vercel Project**, completely segregated from the public customer-facing website project (`the-skin-tree`).

- [ ] **Create New Vercel Project:** Link to the GitHub repository `Theskintree`.
- [ ] **Project Name:** `the-skin-tree-admin`
- [ ] **Root Directory:** `admin`
- [ ] **Framework Preset:** `Vite`
- [ ] **Include Files Outside the Root Directory:** **Enabled (Checked)**
  - *Reason:* The admin portal imports shared validation, phone normalization, and treatment constants from the root monorepo directory `@theskintree/shared`.
- [ ] **Build Command:** `npm run build` (Vite build)
- [ ] **Output Directory:** `dist`
- [ ] **Node.js Version:** `18.x` or `20.x`

---

## 2. Required Environment Variable Names

Configure the following environment variable **NAMES** in the Vercel Dashboard under **Project Settings > Environment Variables** for **Production** and **Preview** environments.

> [!CAUTION]
> Do NOT share, log, or commit the values of these variables.

### A. Database Connections (Least-Privilege Roles)
- `ADMIN_BOOKING_DATABASE_URL`
  - *Description:* PostgreSQL connection string using the `admin_booking` database role (used for schedule view, booking confirmation/cancellation, slot blocks, and audit logging).
- `ADMIN_CLINICAL_DATABASE_URL`
  - *Description:* PostgreSQL connection string using the `admin_clinical` database role (used exclusively by the medical doctor for clinical EMR consultations and prescriptions; forbidden to reception).

### B. Supabase Authentication
- `SUPABASE_URL` / `VITE_SUPABASE_URL`
  - *Description:* Supabase project API URL.
- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
  - *Description:* Supabase anonymous public key for staff authentication.
- `SUPABASE_SERVICE_ROLE_KEY`
  - *Description:* Supabase service role key for serverless admin staff provisioning and role synchronization.

### C. Clinic Communications
- `CLINIC_WHATSAPP` / `VITE_CLINIC_WHATSAPP`
  - *Description:* Official clinic WhatsApp phone number in E.164 format (e.g., `+91...`) used for patient contact links and notifications.

---

## 3. Post-Deployment Verification Steps

1. **Root & Authentication:**
   - [ ] Navigate to the Admin production URL. Verify HTTP 200 and redirect to `/login`.
   - [ ] Log in with receptionist credentials. Verify dashboard loads with role badge `reception`.
2. **Access Control Boundary:**
   - [ ] As `reception`, attempt to navigate to `/patients/[ref]`. Confirm medical records and clinical notes are inaccessible and return HTTP 403 Forbidden.
3. **Pending Queue & Booking Confirmation:**
   - [ ] Navigate to `/schedule`.
   - [ ] Click the **Pending Queue** toggle. Verify pending booking requests appear.
   - [ ] Click **WhatsApp Patient** to verify dynamic link opens WhatsApp chat with the patient's phone.
   - [ ] Click **Confirm Booking** on a pending booking. Confirm status changes to `confirmed` and `booking.audit_log` records a `BOOKING_CONFIRM` entry.
   - [ ] Click **Cancel Request** on a pending booking. Verify prompt for cancellation reason, confirm status updates to `cancelled` with reason, and `booking.audit_log` records `BOOKING_CANCEL`.
