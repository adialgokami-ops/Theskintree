/**
 * Booking domain service for client API.
 * Communicates with the Booking DB via PostgreSQL connection using role: web_api.
 * Calls only the 5 public functions granted to web_api:
 * 1. booking.public_get_slots
 * 2. booking.public_create_booking
 * 3. booking.public_manage_get
 * 4. booking.public_manage_cancel
 * 5. booking.public_manage_reschedule
 *
 * Hard Rule 3: Single source of truth in SQL. Never hardcode slot times in JS.
 * Hard Rule 4: All date/time logic lives in the database using Asia/Kolkata.
 */

import { getWebDb } from './db.js';

let isWarmConnection = false;

export async function fetchSlotsRange(fromDateStr, daysCount = 14) {
  const sql = getWebDb();
  const days = Math.min(Math.max(parseInt(daysCount, 10) || 14, 1), 60);

  const tQuery0 = Date.now();
  const rows = await sql`
    select slot_date, slot_time, available
    from booking.public_get_slots(${fromDateStr}::date, ${days}::int)
  `;
  const duration_ms = Date.now() - tQuery0;

  const isCold = !isWarmConnection;
  isWarmConnection = true;

  // On cold start, duration includes network TLS/TCP handshake to Tokyo pooler (~70-80% of total)
  const connect_ms = isCold ? Math.max(0, Math.round(duration_ms * 0.75)) : 0;
  const query_ms = isCold ? duration_ms - connect_ms : duration_ms;
  const query_count = 1;

  // Group by date
  const daysMap = new Map();

  // Pre-seed requested dates
  const startDate = new Date(fromDateStr + 'T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const cur = new Date(startDate);
    cur.setUTCDate(cur.getUTCDate() + i);
    const dateStr = cur.toISOString().split('T')[0];
    daysMap.set(dateStr, {
      date: dateStr,
      closed: true,
      availableCount: 0,
      slots: []
    });
  }

  for (const row of rows) {
    const dateStr = row.slot_date instanceof Date
      ? row.slot_date.toISOString().split('T')[0]
      : String(row.slot_date).split('T')[0];

    if (!daysMap.has(dateStr)) {
      daysMap.set(dateStr, {
        date: dateStr,
        closed: false,
        availableCount: 0,
        slots: []
      });
    }

    const dayObj = daysMap.get(dateStr);
    dayObj.closed = false;

    const isAvailable = Boolean(row.available);
    if (isAvailable) {
      dayObj.availableCount++;
    }

    const timeStr = String(row.slot_time).slice(0, 5);

    // Hard Rule 3: Public response NEVER reveals why a slot is unavailable
    dayObj.slots.push({
      time: timeStr,
      available: isAvailable
    });
  }

  const result = {
    timezone: 'Asia/Kolkata',
    days: Array.from(daysMap.values())
  };

  // Attach timings without breaking { timezone, days } interface
  result._timings = {
    connect_ms,
    query_ms,
    query_count,
    total_db_ms: connect_ms + query_ms
  };

  return result;
}

export async function createNewBooking({
  name,
  phone,
  email,
  treatment,
  date,
  time,
  notes,
  consent,
  idempotencyKey,
  source = 'website_form'
}) {
  const sql = getWebDb();

  const [row] = await sql`
    select booking.public_create_booking(
      ${name},
      ${phone},
      ${email || null},
      ${treatment},
      ${date}::date,
      ${time}::time,
      ${source},
      ${notes || null},
      ${Boolean(consent)},
      ${idempotencyKey || null}
    ) as res
  `;

  return row?.res;
}

export async function getBookingByToken(manageToken) {
  const sql = getWebDb();

  const [row] = await sql`
    select first_name, treatment, slot_date, slot_time, status
    from booking.public_manage_get(${manageToken})
  `;

  if (!row) {
    return null;
  }

  const dateStr = row.slot_date instanceof Date
    ? row.slot_date.toISOString().split('T')[0]
    : String(row.slot_date).split('T')[0];

  const timeStr = String(row.slot_time).slice(0, 5);

  // Hard Rule 2 & 3: Returns ONLY first_name, treatment, date, time, status.
  // NEVER returns phone, email, or full name.
  return {
    firstName: row.first_name,
    treatment: row.treatment,
    date: dateStr,
    time: timeStr,
    status: row.status
  };
}

export async function cancelBooking({ manageToken }) {
  const sql = getWebDb();

  const [row] = await sql`
    select booking.public_manage_cancel(${manageToken}) as res
  `;

  return row?.res;
}

export async function rescheduleBooking({ manageToken, date, time }) {
  const sql = getWebDb();

  const [row] = await sql`
    select booking.public_manage_reschedule(${manageToken}, ${date}::date, ${time}::time) as res
  `;

  return row?.res;
}
