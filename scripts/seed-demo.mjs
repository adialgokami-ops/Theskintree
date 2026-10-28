#!/usr/bin/env node
/**
 * scripts/seed-demo.mjs
 * Seeds realistic fake clinic data into booking and clinical schemas.
 * Step 4: Uses admin_booking for scheduling tables and admin_clinical for clinical tables.
 * Hard Rule 9: Fake data only. Never real patient data. Fails in production.
 * Usage: node scripts/seed-demo.mjs [--reset]
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Production guard
if (process.env.NODE_ENV === 'production') {
  console.error('❌ FATAL: Refusing to seed demo data in production environment.');
  process.exit(1);
}

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

const adminBookingUrl = process.env.ADMIN_BOOKING_DATABASE_URL;
const adminClinicalUrl = process.env.ADMIN_CLINICAL_DATABASE_URL;

if (!adminBookingUrl || !adminClinicalUrl) {
  console.error('❌ Error: ADMIN_BOOKING_DATABASE_URL and ADMIN_CLINICAL_DATABASE_URL must be set.');
  process.exit(1);
}

const bookingSql = postgres(adminBookingUrl, { prepare: false, max: 1, ssl: 'require' });
const clinicalSql = postgres(adminClinicalUrl, { prepare: false, max: 1, ssl: 'require' });

const isReset = process.argv.includes('--reset');

function getIstDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

async function main() {
  console.log('🌿 The Skin Tree - Seeding Fake Clinic Demo Data...');

  try {
    if (isReset) {
      console.log('⚠️ --reset flag provided. Purging existing demo records...');
      try {
        await clinicalSql`delete from clinical.medications`;
        await clinicalSql`delete from clinical.consultations`;
        await clinicalSql`delete from clinical.reminder_log`;
        await clinicalSql`delete from clinical.access_log`;
        await clinicalSql`delete from clinical.clinical_patients`;

        await bookingSql`delete from booking.slot_blocks`;
        await bookingSql`delete from booking.bookings`;
        await bookingSql`delete from booking.contacts`;
        console.log('✅ Existing records cleared.');
      } catch (e) {
        console.warn('Reset warning:', e.message);
      }
    }

    // 1. Seed Contacts in booking schema
    console.log('Creating contacts in booking schema...');
    const fakeContacts = [
      {
        full_name: 'Ananya Roy',
        phone: '+919820011111',
        email: 'ananya.roy.demo@example.com',
        reminder_consent: true
      },
      {
        full_name: 'Vikram Malhotra',
        phone: '+919820022222',
        email: 'vikram.malhotra.demo@example.com',
        reminder_consent: true
      },
      {
        full_name: 'Meera Kapoor',
        phone: '+919820033333',
        email: 'meera.kapoor.demo@example.com',
        reminder_consent: false
      },
      {
        full_name: 'Rohan Sharma',
        phone: '+919820044444',
        email: 'rohan.sharma.demo@example.com',
        reminder_consent: true
      }
    ];

    const createdContacts = [];
    for (const c of fakeContacts) {
      const [contact] = await bookingSql`
        insert into booking.contacts (full_name, phone, email, reminder_consent, consent_updated_at)
        values (${c.full_name}, ${c.phone}, ${c.email}, ${c.reminder_consent}, ${c.reminder_consent ? bookingSql`now()` : null})
        on conflict (phone, name_key) do update set
          email = excluded.email,
          reminder_consent = excluded.reminder_consent
        returning *
      `;
      createdContacts.push(contact);
    }
    console.log(`✅ Seeded ${createdContacts.length} contacts.`);

    const tomorrow = getIstDateStr(1);
    const dayAfter = getIstDateStr(2);
    const in3Days = getIstDateStr(3);

    // 2. Seed Bookings in booking schema
    console.log('Creating bookings in booking schema...');
    if (createdContacts.length >= 4) {
      const fakeBookings = [
        {
          patient_ref: createdContacts[0].patient_ref,
          treatment: 'Medical Hydrafacial MD®',
          slot_date: tomorrow,
          slot_time: '10:00:00',
          status: 'confirmed',
          source: 'website_form',
          notes: 'Concerned about dullness and congestion before a wedding',
          staff_notes: 'Prefers quiet treatment room'
        },
        {
          patient_ref: createdContacts[1].patient_ref,
          treatment: 'Advanced Chemical Peels',
          slot_date: tomorrow,
          slot_time: '11:30:00',
          status: 'pending',
          source: 'ai_chat',
          notes: 'Pigmentation and dark spots on cheeks',
          staff_notes: 'Requested Dr. Aishwarya consultation'
        },
        {
          patient_ref: createdContacts[2].patient_ref,
          treatment: 'Laser Skin Rejuvenation',
          slot_date: dayAfter,
          slot_time: '14:30:00',
          status: 'confirmed',
          source: 'admin_manual',
          notes: 'Follow-up laser session 2 of 4',
          staff_notes: 'Patch test completed on previous visit'
        },
        {
          patient_ref: createdContacts[3].patient_ref,
          treatment: 'Acne & Scar Clarifying Protocol',
          slot_date: in3Days,
          slot_time: '09:00:00',
          status: 'confirmed',
          source: 'website_form',
          notes: 'Active flare-ups and post-inflammatory erythema'
        }
      ];

      for (const b of fakeBookings) {
        await bookingSql`
          insert into booking.bookings (
            patient_ref, treatment, slot_date, slot_time, status, source, notes, staff_notes
          ) values (
            ${b.patient_ref}, ${b.treatment}, ${b.slot_date}::date, ${b.slot_time}::time,
            ${b.status}, ${b.source}, ${b.notes}, ${b.staff_notes || null}
          )
          on conflict do nothing
        `;
      }
      console.log('✅ Seeded demo bookings.');
    }

    // 3. Seed Slot Block in booking schema
    console.log('Creating slot block in booking schema...');
    await bookingSql`
      insert into booking.slot_blocks (slot_date, slot_time, reason)
      values (${dayAfter}::date, '16:00:00'::time, 'Dr. Aishwarya Clinical Laser Symposium')
    `;

    // 4. Seed Clinical Schema
    console.log('Creating confidential records in clinical schema...');
    const p1 = createdContacts[0].patient_ref;
    const p2 = createdContacts[1].patient_ref;

    // Profiles
    await clinicalSql`
      insert into clinical.clinical_patients (
        patient_ref, skin_type, allergies, medical_history, date_of_birth, gender, emergency_contact
      ) values (
        ${p1}, 'III', 'None reported',
        'Adult onset hormonal acne; responds well to salicylic peels',
        '1994-06-15'::date, 'female', 'Kabir Roy (+91 98200 99999)'
      ), (
        ${p2}, 'IV', 'Salicylic Acid sensitivity (contact erythema)',
        'Sun-induced epidermal melasma across zygomatic arch',
        '1989-11-22'::date, 'male', 'Neha Malhotra (+91 98200 88888)'
      )
      on conflict (patient_ref) do update set
        skin_type = excluded.skin_type,
        allergies = excluded.allergies
    `;

    // Consultation
    const [consult1] = await clinicalSql`
      insert into clinical.consultations (
        patient_ref, chief_complaint, examination_findings, diagnosis, clinical_notes, plan, follow_up_date
      ) values (
        ${p1},
        'Persistent dark spots on cheeks following breakouts',
        'Epidermal hyperpigmentation with intact skin barrier',
        'Post-Inflammatory Hyperpigmentation (PIH)',
        'Prescribed targeted cellular turnover regimen and mineral sunscreen',
        '3 sessions of bespoke lactic peels spaced 3 weeks apart',
        ${getIstDateStr(21)}::date
      )
      returning id
    `;

    // Medications
    await clinicalSql`
      insert into clinical.medications (
        patient_ref, consultation_id, name, dosage, frequency, duration_days, instructions, status
      ) values (
        ${p1}, ${consult1.id}, 'Azelaic Acid Gel 15%', 'Pea-sized amount',
        'Once nightly before sleep', 30,
        'Apply over dry skin after gentle cleansing. SPF 50 daily is mandatory.',
        'active'
      ), (
        ${p2}, null, 'Tranexamic Acid Serum 3%', '3-4 drops',
        'Twice daily', 45,
        'Massage gently on affected areas prior to moisturiser.',
        'active'
      )
    `;

    console.log('✅ Seeded clinical profiles, consultations, and medications.');

    console.log('\n======================================================');
    console.log('🌿 Demo Data Seeding Complete!');
    console.log('   Contacts:       4 patients');
    console.log(`   Bookings:       Tomorrow (${tomorrow}), Day after (${dayAfter})`);
    console.log('   Slot Block:     1 block');
    console.log('   Clinical Chart: 2 profiles, 1 consultation, 2 medications');
    console.log('======================================================\n');
  } finally {
    await bookingSql.end();
    await clinicalSql.end();
  }
}

main().catch((err) => {
  console.error('Unhandled seed error:', err);
  process.exit(1);
});
