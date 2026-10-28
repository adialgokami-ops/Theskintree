#!/usr/bin/env node
/**
 * scripts/test-pending-expiry.mjs
 * Verification Test Suite for Lazy Pending Booking Expiry & Safeguards:
 *
 * Test 1: A pending booking blocks its slot.
 * Test 2: An expired pending booking frees the slot and a new booking succeeds.
 * Test 3: The 3-per-phone rate limit cap (86400s window) holds.
 * Test 4: Confirmed bookings never expire even past the 2-hour window.
 *
 * Rule Compliance: Does NOT execute SQL against the live database.
 */

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Pure JavaScript replication of SQL expiry logic from:
// booking.calculate_booking_expiry(p_created_at, p_slot_date, p_slot_time)
// -----------------------------------------------------------------------------
function calculateBookingExpiry({ createdAt, slotDate, slotTime }) {
  // Parse in Asia/Kolkata
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const createdDate = new Date(createdAt);
  const createdUtcMs = createdDate.getTime();
  const createdIst = new Date(createdUtcMs + kolkataOffsetMs);

  const dow = createdIst.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = createdIst.getUTCHours();
  const minutes = createdIst.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const OPEN_MINUTES = 9 * 60; // 09:00
  const CLOSE_MINUTES = 16 * 60; // 16:00

  let clockStartIst;

  if (dow >= 1 && dow <= 6 && timeInMinutes >= OPEN_MINUTES && timeInMinutes < CLOSE_MINUTES) {
    // During clinic hours
    clockStartIst = new Date(createdIst);
  } else if (dow >= 1 && dow <= 6 && timeInMinutes < OPEN_MINUTES) {
    // Early morning on operating day -> today at 09:00
    clockStartIst = new Date(createdIst);
    clockStartIst.setUTCHours(9, 0, 0, 0);
  } else if (dow >= 1 && dow <= 5 && timeInMinutes >= CLOSE_MINUTES) {
    // Mon-Fri evening -> tomorrow at 09:00
    clockStartIst = new Date(createdIst);
    clockStartIst.setUTCDate(clockStartIst.getUTCDate() + 1);
    clockStartIst.setUTCHours(9, 0, 0, 0);
  } else if (dow === 6 && timeInMinutes >= CLOSE_MINUTES) {
    // Sat evening -> Monday at 09:00 (skip Sunday)
    clockStartIst = new Date(createdIst);
    clockStartIst.setUTCDate(clockStartIst.getUTCDate() + 2);
    clockStartIst.setUTCHours(9, 0, 0, 0);
  } else {
    // Sunday -> Monday at 09:00
    clockStartIst = new Date(createdIst);
    clockStartIst.setUTCDate(clockStartIst.getUTCDate() + 1);
    clockStartIst.setUTCHours(9, 0, 0, 0);
  }

  // 2 hours from clock start
  const clockExpiryUtcMs = (clockStartIst.getTime() - kolkataOffsetMs) + (2 * 60 * 60 * 1000);

  // Appointment start minus 1 hour
  const [slotH, slotM] = slotTime.split(':').map(Number);
  const slotDateParts = slotDate.split('-').map(Number);
  // Slot in IST
  const slotIst = new Date(Date.UTC(slotDateParts[0], slotDateParts[1] - 1, slotDateParts[2], slotH, slotM, 0));
  const slotUtcMs = slotIst.getTime() - kolkataOffsetMs;
  const apptCutoffUtcMs = slotUtcMs - (1 * 60 * 60 * 1000);

  // min(clockExpiry, apptCutoff)
  const expiryUtcMs = Math.min(clockExpiryUtcMs, apptCutoffUtcMs);
  return new Date(expiryUtcMs);
}

// -----------------------------------------------------------------------------
// Simulated Database Store mirroring Postgres constraints & partial unique index
// -----------------------------------------------------------------------------
class MockBookingStore {
  constructor() {
    this.bookings = [];
  }

  // Corresponds to booking.expire_pending_bookings()
  expirePendingBookings(now = new Date()) {
    let expiredCount = 0;
    for (const b of this.bookings) {
      // Confirmed bookings NEVER expire
      if (b.status === 'confirmed') continue;

      if (b.status === 'pending') {
        const expiry = calculateBookingExpiry({
          createdAt: b.created_at,
          slotDate: b.slot_date,
          slotTime: b.slot_time
        });
        if (now.getTime() >= expiry.getTime()) {
          b.status = 'cancelled';
          b.cancellation_reason = 'unconfirmed_expired';
          b.updated_at = now.toISOString();
          expiredCount++;
        }
      }
    }
    return expiredCount;
  }

  // Slot availability check with lazy expiration
  isSlotAvailable(date, time, now = new Date()) {
    this.expirePendingBookings(now);
    // one_active_booking_per_slot index condition: status in ('pending', 'confirmed')
    const activeBooking = this.bookings.find(
      (b) => b.slot_date === date && b.slot_time === time && ['pending', 'confirmed'].includes(b.status)
    );
    return !activeBooking;
  }

  // Corresponds to booking._create_booking_core(...)
  createBooking({ name, phone, date, time, status = 'pending', createdAt = new Date().toISOString() }, now = new Date()) {
    this.expirePendingBookings(now);

    // Concurrency guard: one_active_booking_per_slot
    const conflict = this.bookings.find(
      (b) => b.slot_date === date && b.slot_time === time && ['pending', 'confirmed'].includes(b.status)
    );
    if (conflict) {
      return { ok: false, code: 'SLOT_TAKEN' };
    }

    const newBooking = {
      id: `bk-${this.bookings.length + 1}`,
      name,
      phone,
      slot_date: date,
      slot_time: time,
      status,
      created_at: createdAt,
      updated_at: createdAt
    };
    this.bookings.push(newBooking);
    return { ok: true, booking: newBooking };
  }
}

console.log('🧪 Running Lazy Pending Expiry & Security Control Tests...\n');

// =============================================================================
// TEST 1: A pending booking blocks its slot
// =============================================================================
console.log('--- Test 1: Pending booking blocks slot ---');
{
  const store = new MockBookingStore();
  const now = new Date('2026-10-29T10:00:00+05:30'); // Thursday 10:00 AM IST

  const res1 = store.createBooking({
    name: 'Ananya Roy',
    phone: '+919820011111',
    date: '2026-10-29',
    time: '14:30',
    status: 'pending',
    createdAt: now.toISOString()
  }, now);

  assert(res1.ok === true, 'First booking creates pending reservation');
  assert(store.isSlotAvailable('2026-10-29', '14:30', now) === false, 'Slot reports as UNAVAILABLE while pending');

  // Attempt second booking on the same slot
  const res2 = store.createBooking({
    name: 'Rohan Sharma',
    phone: '+919820022222',
    date: '2026-10-29',
    time: '14:30',
    status: 'pending',
    createdAt: now.toISOString()
  }, now);

  assert(res2.ok === false && res2.code === 'SLOT_TAKEN', 'Second booking attempt fails with SLOT_TAKEN');
}

// =============================================================================
// TEST 2: An expired pending booking frees slot and a new booking succeeds
// =============================================================================
console.log('\n--- Test 2: Expired pending booking frees slot & new booking succeeds ---');
{
  const store = new MockBookingStore();
  const bookingTime = new Date('2026-10-29T10:00:00+05:30'); // Created Thursday 10:00 AM IST

  // Slot is for Friday 11:30 AM IST
  store.createBooking({
    name: 'Pooja Verma',
    phone: '+919820033333',
    date: '2026-10-30',
    time: '11:30',
    status: 'pending',
    createdAt: bookingTime.toISOString()
  }, bookingTime);

  // 1 hour later (11:00 AM IST): still within 2-hour window
  const check1Time = new Date('2026-10-29T11:00:00+05:30');
  assert(store.isSlotAvailable('2026-10-30', '11:30', check1Time) === false, 'Slot is still held 1 hour after booking');

  // 2 hours and 1 minute later (12:01 PM IST): 2-hour window has expired!
  const check2Time = new Date('2026-10-29T12:01:00+05:30');
  assert(store.isSlotAvailable('2026-10-30', '11:30', check2Time) === true, 'Slot is automatically FREE after 2 hours');

  // Verify lazy update transitioned row to cancelled with reason unconfirmed_expired
  const row = store.bookings[0];
  assert(row.status === 'cancelled', 'Expired row status transitioned to "cancelled"');
  assert(row.cancellation_reason === 'unconfirmed_expired', 'Cancellation reason set to "unconfirmed_expired"');

  // A new booking on the newly freed slot succeeds
  const resNew = store.createBooking({
    name: 'Karan Mehta',
    phone: '+919820044444',
    date: '2026-10-30',
    time: '11:30',
    status: 'pending',
    createdAt: check2Time.toISOString()
  }, check2Time);

  assert(resNew.ok === true, 'New booking on freed slot succeeds without conflict');
}

// =============================================================================
// TEST 2B: Outside clinic hours (Sunday booking clock starts Monday 09:00 IST)
// =============================================================================
console.log('\n--- Test 2B: Sunday booking clock starts Monday 09:00 IST ---');
{
  const store = new MockBookingStore();
  // Booked on Sunday 14:00 IST
  const sundayNoon = new Date('2026-11-01T14:00:00+05:30'); // Sunday

  store.createBooking({
    name: 'Sunil Nair',
    phone: '+919820055555',
    date: '2026-11-03',
    time: '10:00',
    status: 'pending',
    createdAt: sundayNoon.toISOString()
  }, sundayNoon);

  // On Sunday evening (18:00 IST) - 4 hours after creation, but clinic hasn't opened yet!
  const sundayEvening = new Date('2026-11-01T18:00:00+05:30');
  assert(store.isSlotAvailable('2026-11-03', '10:00', sundayEvening) === false, 'Sunday booking does NOT expire on Sunday');

  // On Monday morning 09:30 IST - clock started Monday 09:00, so expires Monday 11:00
  const mondayMorning = new Date('2026-11-02T09:30:00+05:30');
  assert(store.isSlotAvailable('2026-11-03', '10:00', mondayMorning) === false, 'Booking is active Monday morning before 11:00');

  // On Monday at 11:05 IST - 2 hours after Monday 09:00 opening
  const mondayPast11 = new Date('2026-11-02T11:05:00+05:30');
  assert(store.isSlotAvailable('2026-11-03', '10:00', mondayPast11) === true, 'Sunday booking expires Monday at 11:00 (2 hrs from opening)');
}

// =============================================================================
// TEST 3: 3-per-phone rate limit cap (86400s window) holds
// =============================================================================
console.log('\n--- Test 3: 3-per-phone daily cap holds ---');
{
  const phoneReservations = new Map();
  const RATE_LIMIT_CAP = 3;
  const WINDOW_SECONDS = 86400; // 24 hours

  function recordBookingAttempt(phone, timestampMs) {
    const list = phoneReservations.get(phone) || [];
    const valid = list.filter((t) => timestampMs - t < WINDOW_SECONDS * 1000);
    if (valid.length >= RATE_LIMIT_CAP) {
      return { ok: false, error: 'Maximum 3 bookings per phone per day allowed.' };
    }
    valid.push(timestampMs);
    phoneReservations.set(phone, valid);
    return { ok: true, remaining: RATE_LIMIT_CAP - valid.length };
  }

  const testPhone = '+919999988888';
  const t0 = Date.now();

  const r1 = recordBookingAttempt(testPhone, t0);
  assert(r1.ok === true && r1.remaining === 2, 'Attempt 1/3 succeeds');

  const r2 = recordBookingAttempt(testPhone, t0 + 1000);
  assert(r2.ok === true && r2.remaining === 1, 'Attempt 2/3 succeeds');

  const r3 = recordBookingAttempt(testPhone, t0 + 2000);
  assert(r3.ok === true && r3.remaining === 0, 'Attempt 3/3 succeeds');

  const r4 = recordBookingAttempt(testPhone, t0 + 3000);
  assert(r4.ok === false, 'Attempt 4/3 rejected under 3-per-phone cap');

  // Next day (after 86400s window)
  const nextDay = t0 + (86401 * 1000);
  const r5 = recordBookingAttempt(testPhone, nextDay);
  assert(r5.ok === true, 'Booking succeeds after 24-hour rate limit window resets');
}

// =============================================================================
// TEST 4: Confirmed bookings never expire
// =============================================================================
console.log('\n--- Test 4: Confirmed bookings never expire ---');
{
  const store = new MockBookingStore();
  const createdAt = new Date('2026-10-25T10:00:00+05:30'); // 4 days ago

  store.createBooking({
    name: 'Dr. Confirmed Patient',
    phone: '+919820099999',
    date: '2026-10-31',
    time: '10:00',
    status: 'confirmed', // Confirmed by reception / admin
    createdAt: createdAt.toISOString()
  }, createdAt);

  // Check 4 days later
  const fourDaysLater = new Date('2026-10-29T10:00:00+05:30');
  const expiredCount = store.expirePendingBookings(fourDaysLater);

  assert(expiredCount === 0, 'expirePendingBookings does NOT touch confirmed bookings');
  assert(store.bookings[0].status === 'confirmed', 'Confirmed booking status remains "confirmed"');
  assert(store.isSlotAvailable('2026-10-31', '10:00', fourDaysLater) === false, 'Slot remains booked and protected');
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log(`\n================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`================================`);

if (failed > 0) {
  process.exit(1);
}
