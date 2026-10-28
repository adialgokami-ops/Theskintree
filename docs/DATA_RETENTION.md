# Data Retention & Privacy Policy (DPDP Act 2023 Compliance)

**Clinic:** The Skin Tree (Luxury Aesthetic Dermatology, Bandra West, Mumbai)  
**Lead Doctor:** Dr. Aishwarya Agarwal, MBBS, MD Dermatology  
**Applicable Regulations:**
- Digital Personal Data Protection Act, 2023 (DPDP Act 2023 - India)
- National Medical Commission (NMC) Registered Medical Practitioner Regulations / MCI Code of Ethics 2002
- Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011

---

## 1. Statutory Data Classification & Retention Schedule

The Skin Tree classifies all collected data into four distinct tiers based on clinical necessity, privacy sensitivity, and statutory retention mandates under Indian law:

| Data Category | Examples | Minimum Retention Period | Statutory Basis | Disposal Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Clinical EMR Records** | Consultation notes, examination findings, diagnoses, prescriptions, treatment plans, skin assessment | **3 Years** from last consultation (5 years for minor patients or ongoing procedures) | NMC Regulations 2002 (Clause 1.3.1) / Medical Records Standards | Cryptographic anonymization / certified electronic shredding |
| **Tier 2: Appointment & Booking Data** | Patient full name, phone number, email, appointment date/time, selected treatment, management token hash | **1 Year** post-appointment completion | DPDP Act 2023 (Purpose Limitation & Storage Limitation) | Automated soft-delete with 30-day purge cycle |
| **Tier 3: AI Chatbot & Concierge Transcripts** | Inquiry messages, general skin guidance conversations, slot lookup history | **90 Days** from interaction | DPDP Act 2023 Section 8(7) (Purpose Fulfillment) | Automated database truncation; PII stripped prior to LLM processing |
| **Tier 4: Audit Trails & Security Logs** | `booking.audit_log`, `clinical.access_log`, MFA authentication logs, IP rate-limit records | **7 Years** | CERT-In Cyber Security Directions 2022 / Evidence Act compliance | Append-only tamper-evident hash chain preserved in cold storage |

---

## 2. DPDP Act 2023: Patient Rights & Governance

Under the Digital Personal Data Protection Act, 2023, patients are recognized as **Data Principals** and The Skin Tree acts as the **Data Fiduciary**.

### 2.1 Right to Access & Summary of Personal Data (Section 11)
- Patients may request a summary of personal data processed, identities of medical staff who accessed it, and consultation history.
- Requests must be verified via phone OTP or government photo ID (Aadhaar / Passport) before disclosure.
- Fulfilled within 72 business hours in standard machine-readable format (JSON or PDF).

### 2.2 Right to Correction & Erasure (Section 12)
- **Correction:** Patients may update incorrect contact details (phone, email) or address via their management portal or clinic reception.
- **Erasure Requests:** When a patient requests complete erasure of their data:
  1. Non-clinical marketing or reminder consent is immediately revoked.
  2. Public booking records older than 90 days are permanently purged.
  3. **Statutory Medical Exception:** In compliance with NMC Regulations Clause 1.3, clinical medical records (diagnoses, consultation notes, prescriptions) **CANNOT be destroyed prior to the mandatory 3-year retention window**, as these are required for medicolegal defense, prescription audits, and patient safety. Once the 3-year period elapses, the record is permanently deleted.

### 2.3 Right to Grievance Redressal (Section 13)
- The Skin Tree has designated a dedicated Grievance Officer:
  - **Officer:** Clinic Administrator / Data Protection Lead
  - **Email:** `privacy@theskintree.in`
  - **Clinic Address:** Ground Floor, Fortune Chambers, Turner Road, Bandra West, Mumbai 400050
  - **Resolution Timeframe:** Within 7 calendar days of receipt.

---

## 3. Data Minimization & Redaction Architecture

1. **AI Chat Redaction Pipeline:**
   Before any message is transmitted to Google Gemini, client-side and edge server redaction (`client/api/chat.js`) automatically strips:
   - Indian phone numbers (`+91...`, 10-digit mobile numbers)
   - Email addresses
   - UUIDs and management tokens
2. **Management Token Hashing:**
   Patient self-service tokens are stored exclusively as 256-bit SHA-256 hashes (`booking.bookings.manage_token_hash`). The plain token is generated once on the server, transmitted directly to the client browser over TLS, and never stored in plaintext in the database.
3. **Database Role Segregation:**
   - Public web API (`web_api` role) has zero access to tables and can execute only 5 whitelisted stored procedures.
   - Clinical medical records are physically segregated in schema `clinical` and restricted strictly to authenticated medical doctors (`doctor` role) possessing active TOTP multi-factor authentication.

---

## 4. Secure Disposal & Automated Purging

1. **Automated Cron Jobs:**
   - `/api/cron/keepalive` runs daily to monitor system integrity.
   - An automated cleanup job (`cron/purge_expired_tokens`) invalidates management tokens older than 60 days.
2. **Permanent Disposal Protocol:**
   - Digital records marked for deletion are purged using SQL `DELETE` cascades followed by PostgreSQL table vacuuming.
   - Backups containing expired clinical records are automatically aged out according to AWS/Supabase snapshot lifecycle policies.
