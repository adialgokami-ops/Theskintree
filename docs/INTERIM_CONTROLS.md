# Interim Security & Anti-Abuse Controls: The Skin Tree

**Clinic:** The Skin Tree (Bandra West, Mumbai)  
**Lead Dermatologist:** Dr. Aishwarya Agarwal (MBBS, MD Dermatology)  
**Document Status:** HONEST LIVE STATUS AUDIT  
**Last Updated:** October 28, 2026

---

## 1. Controls Currently Live in Deployed Code & Database

These controls are actively enforced in production right now:

| Control | Layer | How It Works | Failure / Action |
| :--- | :--- | :--- | :--- |
| **"Pending Until Reception Confirms"** | Web Client & Database | All website and chatbot bookings insert with `status = 'pending'`. The user is clearly notified: *"Request received. This is not confirmed yet. Our team will call or WhatsApp you to confirm."* | Booking is tentative until reception explicitly verifies and confirms. |
| **Anti-Bot Honeypot** | API (`/api/bookings`) | Hidden `website` field in form payload | Rejects automated bot crawlers immediately with HTTP 400 |
| **Phone Sanitization & Validation** | Shared (`@theskintree/shared`) | Strips non-digits, formats to E.164 `+91[6-9]\d{9}` | Rejects invalid phone numbers with HTTP 400 |
| **Consent Verification** | API (`/api/bookings`) | Validates `consentVersion` (`2026.1-dpdp`) and SHA-256 hash matching displayed text | Rejects stale, mismatched, or missing consent with HTTP 400 |
| **Per-Phone Daily Booking Cap** | API (`/api/bookings`) | Max 3 pending bookings per phone number per day (86,400-second window) | Rejects excessive booking attempts from same phone with HTTP 429 |
| **Per-IP Rate Limiting** | API (`/api/bookings`, `/api/chat`) | Upstash Redis sliding window (fallback to in-memory `Map`): 15 book req / 10 min, 30 chat req / 1 min | Throttles rapid bursts per IP with HTTP 429 |
| **Cloudflare Turnstile Verification** | API (`/api/bookings`) | Verifies Cloudflare Turnstile token on server before processing | Rejects unverified requests with HTTP 400/403 |
| **Atomic Concurrency Locking** | Database (`public_create_booking`) | Postgres transaction with `one_active_booking_per_slot` unique partial index | Rejects concurrent attempts for the same slot with HTTP 409 |
| **Idempotency Protection** | Database (`bookings.idempotency_key`) | Unique UUID per client booking submission | Re-submissions return existing booking ID without duplicate insert |
| **Centralized Clinic Contact Config** | Client & API (`CLINIC_WHATSAPP`) | Clinic phone number resolved exclusively via `CLINIC_WHATSAPP` / `VITE_CLINIC_WHATSAPP`. Zero hard-coded clinic phone numbers. | Logs loud `console.error` if environment variable is missing |
| **Reception Confirmation Queue** | Admin Portal (`/schedule`) | Reception uses dedicated "Pending Queue" toggle to review requests, WhatsApp the patient, and Confirm or Cancel (with mandatory reason) | Writes every confirmation and cancellation directly to `booking.audit_log` |
| **Lazy Expiry Migration Prepared** | Database Migration (`20261028_lazy_pending_expiry.sql`) | Calculates expiry at `min(clock_start + 2h, slot_start - 1h)` (starts at 09:00 IST on next opening if created outside clinic hours or Sunday), marking expired rows `'cancelled'` with reason `'unconfirmed_expired'` | Automatically frees slots during slot computation without modifying existing index |

---

## 2. Dormant / Non-Active Elements

- **Phone OTP Verification (`REQUIRE_PHONE_OTP=false`):**
  - The OTP UI (code field and "Send OTP" button) has been removed from `Booking.jsx` to eliminate customer friction and third-party SMS failures.
  - `/api/otp/send` remains in place in the codebase but is unused by the booking flow.

---

## 3. Residual Risks

Because bookings are submitted without pre-submission SMS OTP verification, two residual operational risks remain:

1. **Slot Holding While Pending:**
   - **Risk:** Because an unconfirmed pending booking blocks the selected slot to prevent double-booking, an unconfirmed reservation holds that slot for up to 2 hours (or until 1 hour prior to appointment start) before lazy expiry automatically frees it.
   - **Mitigation:** The 3-per-phone-per-day rate limit and IP-based rate limiting prevent bulk slot hoarding. Reception's Pending Queue enables quick confirmation or manual cancellation with a reason.
2. **Booking Under Another Person's Number:**
   - **Risk:** Without an SMS OTP challenge, a user could enter someone else's phone number when requesting an appointment.
   - **Mitigation:** The booking is **not confirmed** upon form submission. The confirmation screen explicitly states that clinic staff will call or WhatsApp the number to verify before the booking is ever confirmed. If the person reached states they did not request the appointment, reception clicks "Cancel Request" with reason `"unauthorized_number"`, which cancels the booking and logs to `booking.audit_log`.
