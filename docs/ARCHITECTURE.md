# System Architecture & Live Schema: The Skin Tree

**Clinic:** The Skin Tree (Luxury Aesthetic Sanctuary, Bandra West, Mumbai)  
**Lead Dermatologist:** Dr. Aishwarya Agarwal (MBBS, MD Dermatology)  
**Source of Truth:** Live PostgreSQL Database (`information_schema` & `pg_proc`)  
**Generated At:** October 28, 2026

---

## 1. High-Level Architecture Overview

The Skin Tree operates on a unified PostgreSQL database with dual isolated schemas (`booking` and `clinical`) enforcing strict least-privilege security at the database engine level:

```
┌────────────────────────────────────────────────────────┐
│                   PUBLIC SURFACE                       │
│  - Vite Client React App (client/)                     │
│  - Streaming AI Concierge (/api/chat)                 │
│  - Public Booking Flow (/api/bookings)                 │
└──────────────────────────┬─────────────────────────────┘
                           │ Role: web_api (EXECUTE only on 5 public functions)
                           ▼
┌────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE ENGINE                │
│                                                        │
│  [SCHEMA: booking]                                     │
│  ├── audit_log (immutable append-only log)             │
│  ├── bookings (consultation appointments)             │
│  ├── clinic_settings (advance booking window bounds)  │
│  ├── contacts (patient contact registry)              │
│  ├── slot_blocks (doctor emergency/leave blocks)       │
│  ├── staff (internal staff roles & active status)      │
│  └── weekly_slots (operating template: Mon-Sat 09-16)  │
│                                                        │
│  [SCHEMA: clinical]                                    │
│  ├── access_log (immutable audit of EMR reads/writes)  │
│  ├── clinical_patients (dermatological patient cards)  │
│  ├── consultations (clinical EMR visits & findings)    │
│  ├── medications (prescriptions & regimens)            │
│  └── reminder_log (clinical outreach audit)            │
└──────────────────────────▲─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       │ Role: admin_booking                   │ Role: admin_clinical
       │ (DML on booking, zero clinical)       │ (DML on clinical, SELECT on booking)
┌──────┴──────────────┐                 ┌──────┴──────────────┐
│  RECEPTION PORTAL   │                 │   DOCTOR EMR PORTAL │
│  - Staff scheduling │                 │   - Clinical cards  │
│  - Patient check-in │                 │   - Prescriptions   │
└─────────────────────┘                 └─────────────────────┘
```

---

## 2. PostgreSQL Role Separation & Privileges

| Role Name | Scope / Surface | Table Permissions | Routine Privileges | Isolation Safeguards |
| :--- | :--- | :--- | :--- | :--- |
| `web_api` | Public web & AI chat | **ZERO table permissions** on any table in any schema | `EXECUTE` strictly on 5 functions: `booking.public_*` | Cannot select contacts, cannot view clinical notes, cannot delete |
| `admin_booking` | Reception & Admin staff | `SELECT, INSERT, UPDATE` on `booking.*` (`DELETE` revoked) | `EXECUTE` on `booking.admin_*` functions | **Zero access** to `clinical.*` schema (SQLSTATE 42501 on query) |
| `admin_clinical` | Lead Doctor (Dr. Aishwarya) | `SELECT, INSERT, UPDATE` on `clinical.*`; `SELECT` on `booking.*` | Internal triggers (`clinical.set_updated_at`) | `access_log` is append-only; cannot modify or insert bookings |
| `anon` / `authenticated` | Supabase default roles | **0 privileges** | **0 privileges** | Default PostgREST API disabled; direct pooler connections only |

---

## 3. Live Database Schemas (from `information_schema`)

### Schema: `booking`

#### 1. `booking.bookings`
Consultation appointments booked by patients or staff.
- `id` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `patient_ref` (`uuid`, NOT NULL, references `booking.contacts.patient_ref`)
- `treatment` (`text`, NOT NULL)
- `slot_date` (`date`, NOT NULL)
- `slot_time` (`time without time zone`, NOT NULL)
- `status` (`text`, NOT NULL, default: `'pending'`)
- `source` (`text`, NOT NULL: `'website_form'`, `'ai_chat'`, `'reception'`)
- `notes` (`text`, patient notes)
- `staff_notes` (`text`, internal receptionist notes)
- `manage_token` (`text`, NOT NULL, default: 24-byte hex string)
- `idempotency_key` (`text`, deduplication token)
- `consent_at` (`timestamptz`)
- `reminder_sent_at` (`timestamptz`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)
- `updated_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 2. `booking.contacts`
Patient identity and contact directory.
- `patient_ref` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `full_name` (`text`, NOT NULL)
- `name_key` (`text`, lowercase search key)
- `phone` (`text`, NOT NULL, E.164 format `+91...`)
- `email` (`text`, optional)
- `reminder_consent` (`boolean`, NOT NULL, default: `false`)
- `consent_updated_at` (`timestamptz`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)
- `updated_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 3. `booking.slot_blocks`
Overrides and unavailability blocks (e.g., doctor surgeries, clinic holidays).
- `id` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `slot_date` (`date`, NOT NULL)
- `slot_time` (`time without time zone`, optional for full-day block)
- `reason` (`text`, internal operational reason)
- `created_by` (`uuid`, staff user id)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 4. `booking.staff`
Clinic staff members linked to Supabase Auth (`user_id`).
- `user_id` (`uuid`, PRIMARY KEY, references `auth.users.id`)
- `name` (`text`, NOT NULL)
- `role` (`text`, NOT NULL: `'doctor'`, `'receptionist'`, `'admin'`)
- `active` (`boolean`, NOT NULL, default: `true`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 5. `booking.weekly_slots`
Clinic operating hours template (Monday to Saturday, 09:00 to 16:00, Sundays closed).
- `weekday` (`smallint`, NOT NULL: 1=Monday .. 6=Saturday)
- `slot_time` (`time without time zone`, NOT NULL)

#### 6. `booking.clinic_settings`
Booking window and anti-hoarding parameters.
- `id` (`integer`, PRIMARY KEY, default: 1)
- `min_advance_hours` (`integer`, NOT NULL, default: 12)
- `max_advance_days` (`integer`, NOT NULL, default: 60)
- `max_active_per_phone` (`integer`, NOT NULL, default: 2)

#### 7. `booking.audit_log`
Immutable record of booking and scheduling actions.
- `id` (`bigint`, PRIMARY KEY, GENERATED ALWAYS AS IDENTITY)
- `staff_id` (`uuid`, NULL for public client actions)
- `action` (`text`, NOT NULL)
- `target_type` (`text`, e.g. `'booking'`)
- `target_id` (`text`, identifier)
- `details` (`jsonb`, contextual metadata)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)

---

### Schema: `clinical`

#### 1. `clinical.clinical_patients`
Dermatological baseline records.
- `patient_ref` (`uuid`, PRIMARY KEY, references `booking.contacts.patient_ref`)
- `skin_type` (`text`, Fitzpatrick skin type or condition)
- `allergies` (`text`)
- `medical_history` (`text`)
- `emergency_contact` (`text`)
- `notes` (`text`)
- `date_of_birth` (`date`)
- `gender` (`text`, default: `'unspecified'`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)
- `updated_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 2. `clinical.consultations`
Confidential electronic medical records (EMR) for doctor visits.
- `id` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `patient_ref` (`uuid`, NOT NULL)
- `doctor_id` (`uuid`, references `booking.staff.user_id`)
- `consultation_date` (`date`, NOT NULL, default: current date in Asia/Kolkata)
- `chief_complaint` (`text`, NOT NULL)
- `examination_findings` (`text`)
- `diagnosis` (`text`)
- `clinical_notes` (`text`)
- `plan` (`text`)
- `follow_up_date` (`date`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)
- `updated_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 3. `clinical.medications`
Prescribed dermatological treatments and medications.
- `id` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `patient_ref` (`uuid`, NOT NULL)
- `consultation_id` (`uuid`, optional)
- `prescribed_by` (`uuid`, references `booking.staff.user_id`)
- `name` (`text`, NOT NULL)
- `dosage` (`text`, NOT NULL)
- `frequency` (`text`, NOT NULL)
- `duration_days` (`integer`)
- `instructions` (`text`)
- `start_date` (`date`, NOT NULL)
- `status` (`text`, NOT NULL, default: `'active'`)
- `created_at` (`timestamptz`, NOT NULL, default: `now()`)
- `updated_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 4. `clinical.access_log`
Immutable, append-only compliance audit trail for DISHA & DPDP Act 2023.
- `id` (`bigint`, PRIMARY KEY, GENERATED ALWAYS AS IDENTITY)
- `staff_id` (`uuid`)
- `staff_role` (`text`, NOT NULL)
- `patient_ref` (`uuid`, NOT NULL)
- `action` (`text`, NOT NULL: `'READ'`, `'CREATE'`, `'UPDATE'`)
- `resource` (`text`, NOT NULL: `'patient'`, `'consultation'`, `'medication'`)
- `metadata` (`jsonb`)
- `accessed_at` (`timestamptz`, NOT NULL, default: `now()`)

#### 5. `clinical.reminder_log`
Outreach notification tracking.
- `id` (`uuid`, PRIMARY KEY, default: `gen_random_uuid()`)
- `patient_ref` (`uuid`, NOT NULL)
- `channel` (`text`, NOT NULL: `'email'`, `'sms'`, `'whatsapp'`)
- `reminder_type` (`text`, NOT NULL)
- `template_name` (`text`)
- `status` (`text`, default: `'sent'`)
- `payload` (`jsonb`)
- `sent_at` (`timestamptz`, NOT NULL, default: `now()`)

---

## 4. Stored Procedures & Interface Boundary

### Public Interface (`web_api` role only):
1. `booking.public_create_booking(p_name text, p_phone text, p_email text, p_treatment text, p_date date, p_time time, p_source text, p_notes text, p_consent boolean, p_idem text) -> jsonb`
2. `booking.public_get_slots(p_from date, p_days integer) -> TABLE(slot_date date, slot_time time, available boolean)`
3. `booking.public_manage_cancel(p_token text) -> jsonb`
4. `booking.public_manage_get(p_token text) -> TABLE(first_name text, treatment text, slot_date date, slot_time time, status text)`
5. `booking.public_manage_reschedule(p_token text, p_new_date date, p_new_time time) -> jsonb`

### Reception Staff Interface (`admin_booking` role):
1. `booking.admin_get_slots(p_from date, p_days integer) -> TABLE(slot_date date, slot_time time, state text, booking_id uuid)`
2. `booking.admin_create_booking(p_name text, p_phone text, p_email text, p_treatment text, p_date date, p_time time, p_notes text, p_staff_notes text) -> jsonb`
3. `booking.admin_cancel_booking(p_booking_id uuid) -> jsonb`
4. `booking.admin_reschedule_booking(p_booking_id uuid, p_new_date date, p_new_time time) -> jsonb`

---

## 5. AI Concierge Architecture (Gemini Only)

- **Provider:** Google Gemini Only (`generativelanguage.googleapis.com/v1beta`). Alternate provider integrations (xAI, Anthropic) have been fully excised.
- **Dual-Key Hedged Racing:** Primary key (`GEMINI_API_KEY`) races with optional secondary key (`GEMINI_API_KEY_2`) from a separate Google Cloud project. If the primary key does not emit a content token within 2,000ms or encounters an immediate failure (429/503/timeout), the second key is dispatched in parallel. Whichever produces the first content token wins; the losing branch is aborted cleanly.
- **Single-Key Fallback:** If `GEMINI_API_KEY_2` is not configured, the adapter logs the absence and executes single-key Gemini without crashing.
- **Quota & 429 Logging:** Full bodies and response headers of any 429 responses are captured and logged with all API keys and authorization tokens strictly redacted.
- **Client-Side 429 Retry & Resilient Concierge Fallback:** `ChatWidget.jsx` initiates an automated client-side retry with a 1500ms delay upon encountering HTTP 429 before rendering the branded fallback containing Dr. Aishwarya's clinic WhatsApp and phone contact (`+91 98200 12345`). Canned messages strictly count as failures in benchmarks.
- **Parallel Slot Prefetch:** In-memory slot caching (20s TTL) injects real-time appointment availability directly into the Gemini system prompt, avoiding latency-heavy multi-turn tool calling.
- **UI-Driven Booking:** The model emits interactive slot chips (`ui: { type: 'slots' }`), driving the user to the secure client-side slot selector and keeping the LLM completely decoupled from booking mutations and consent collection.

