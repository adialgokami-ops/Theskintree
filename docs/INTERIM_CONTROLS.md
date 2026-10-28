# Interim Security & Anti-Abuse Controls: The Skin Tree

**Clinic:** The Skin Tree (Bandra West, Mumbai)  
**Lead Dermatologist:** Dr. Aishwarya Agarwal (MBBS, MD Dermatology)  
**Document Status:** HONEST LIVE STATUS AUDIT  
**Date:** October 28, 2026

---

## 1. Controls Currently Live in Deployed Code & Database

These controls are actively enforced in production / preview right now:

| Control | Layer | How It Works | Failure / Action |
| :--- | :--- | :--- | :--- |
| **Anti-Bot Honeypot** | API (`/api/bookings`) | Hidden `website` field in form payload | Rejects automated bot crawlers immediately with HTTP 400 |
| **Phone Sanitization & Validation** | Shared (`@theskintree/shared`) | Strips non-digits, formats to E.164 `+91[6-9]\d{9}` | Rejects invalid phone numbers with HTTP 400 |
| **Consent Verification** | API (`/api/bookings`) | Validates `consentVersion` (`2026.1-dpdp`) and SHA-256 hash (`6f242e42...`) matching displayed text | Rejects stale, mismatched, or missing consent with HTTP 400 |
| **Atomic Concurrency Locking** | Database (`public_create_booking`) | Postgres transaction with `one_active_booking_per_slot` index | Permitted 1 booking; rejects concurrent attempts with HTTP 409 |
| **Idempotency Protection** | Database (`bookings.idempotency_key`) | Unique UUID per client booking submission | Re-submissions return existing booking ID without duplicate insert |
| **In-Memory Rate Limiting** | Serverless Process (`Map`) | Sliding window per instance (30 chat req/min, 15 book req/min) | Throttles rapid requests on same warm container with HTTP 429 |

---

## 2. Controls Pending Infrastructure / Environment Keys

These controls exist in code but operate in fallback or fail-closed state due to missing environment variables:

| Control | Code Location | Missing Env Vars | Current Real State |
| :--- | :--- | :--- | :--- |
| **Distributed Rate Limiting** | `client/api/server/lib/ratelimit.js` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Falls back to in-memory `Map` per container. Counters do NOT sync across serverless instances. |
| **Cloudflare Turnstile** | `client/api/server/lib/turnstile.js` | `TURNSTILE_SECRET_KEY` | Fails closed: rejects live bookings with `turnstile_misconfigured` unless bypassed in dev. |
| **Phone SMS Gateway** | `client/api/otp/send.js` | `MSG91_AUTH_KEY` / `SMS_API_KEY` | Fails closed in production with HTTP 503 (`sms_service_unavailable`). |

---

## 3. Storage Location of Phone OTP Hashes

- **Exact Location:** Process-level in-memory JavaScript Map (`const otpStore = new Map()`) located in `client/api/server/lib/otp.js`.
- **Payload Stored:** Phone number mapped to `{ hash, expiresAt, attempts }`, where `hash = sha256(phone:otp:secret)`.
- **Persistence:** **Zero persistence.** Hashes are stored in ephemeral serverless container RAM. They are discarded when the container spins down and are not accessible across separate Vercel function instances.
