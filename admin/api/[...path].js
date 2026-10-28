/**
 * Admin API Catch-All Serverless Router: /api/[...path]
 * Uses PostgreSQL connections with least-privilege roles:
 * - admin_booking: used for all scheduling, contacts, blocks, staff, and audit
 * - admin_clinical: used ONLY via PatientRecordService and ReminderService for doctor/admin clinical records
 *
 * Hard Rule 5: Server-side authorization enforced on every route.
 * Reception role receives HTTP 403 Forbidden on all clinical routes.
 */

import { getDbFor, logBookingAudit } from '../server/lib/db.js';
import { requireStaff } from '../server/lib/auth.js';
import { patientRecordsFor, remindersFor } from '../server/clinical/index.js';
import { normalisePhone } from '@theskintree/shared';

function parsePath(req) {
  let p = '';
  if (Array.isArray(req.query?.path)) {
    p = '/' + req.query.path.join('/');
  } else if (typeof req.query?.path === 'string') {
    p = '/' + req.query.path;
  } else {
    const parsed = new URL(req.url, 'http://localhost');
    p = parsed.pathname.replace(/^\/api/, '');
  }
  return p.replace(/\/$/, '') || '/';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const path = parsePath(req);
  const method = req.method;

  try {
    // -------------------------------------------------------------------------
    // 1. /api/me (all active staff)
    // -------------------------------------------------------------------------
    if (path === '/me' && method === 'GET') {
      const { user, staff } = await requireStaff(req);
      return res.status(200).json({
        user: { id: user.id, email: user.email },
        staff
      });
    }

    // -------------------------------------------------------------------------
    // 2. /api/staff (admin only)
    // -------------------------------------------------------------------------
    if (path === '/staff') {
      if (method === 'GET') {
        const { staff: currentStaff } = await requireStaff(req, ['admin']);
        const sql = getDbFor(currentStaff).booking();

        const staffList = await sql`
          select user_id, name, role, active, created_at
          from booking.staff
          order by created_at desc
        `;

        return res.status(200).json({ staff: staffList });
      }

      if (method === 'POST') {
        const { staff: currentStaff } = await requireStaff(req, ['admin']);
        const { email, name, role, user_id } = req.body || {};

        if (!name || !role) {
          return res.status(400).json({ error: 'Name and role are required.' });
        }
        if (!['admin', 'doctor', 'reception'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be admin, doctor, or reception.' });
        }

        const sql = getDbFor(currentStaff).booking();
        const targetUserId = user_id || crypto.randomUUID();

        const [createdStaff] = await sql`
          insert into booking.staff (user_id, name, role, active)
          values (${targetUserId}, ${name.trim()}, ${role}, true)
          returning *
        `;

        await logBookingAudit({
          staffId: currentStaff.user_id,
          action: 'STAFF_CREATE',
          targetType: 'staff',
          targetId: targetUserId,
          details: { name, role, email }
        });

        return res.status(201).json({ staff: createdStaff });
      }
    }

    // PATCH /api/staff/:id (admin only)
    const staffMatch = path.match(/^\/staff\/([a-f0-9-]+)$/i);
    if (staffMatch && method === 'PATCH') {
      const { staff: currentStaff } = await requireStaff(req, ['admin']);
      const targetUserId = staffMatch[1];
      const { role, active, name } = req.body || {};

      const sql = getDbFor(currentStaff).booking();

      const [updatedStaff] = await sql`
        update booking.staff set
          role = coalesce(${role && ['admin', 'doctor', 'reception'].includes(role) ? role : null}, role),
          active = case when ${typeof active === 'boolean'} then ${Boolean(active)} else active end,
          name = coalesce(${name ? name.trim() : null}, name)
        where user_id = ${targetUserId}
        returning *
      `;

      if (!updatedStaff) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'STAFF_UPDATE',
        targetType: 'staff',
        targetId: targetUserId,
        details: { role, active, name }
      });

      return res.status(200).json({ staff: updatedStaff });
    }

    // -------------------------------------------------------------------------
    // 3. /api/schedule?from=YYYY-MM-DD&days=1|7 (all staff)
    // -------------------------------------------------------------------------
    if (path === '/schedule' && method === 'GET') {
      const { staff: currentStaff } = await requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      const sql = getDbFor(currentStaff).booking();

      // Support fetching pending queue directly
      if (url.searchParams.get('pending') === '1') {
        const pendingBookings = await sql`
          select
            b.id, b.patient_ref, b.treatment, b.slot_date, b.slot_time,
            b.status, b.source, b.notes, b.staff_notes, b.manage_token,
            b.reminder_sent_at, b.created_at,
            json_build_object(
              'full_name', c.full_name,
              'phone', c.phone,
              'email', c.email,
              'reminder_consent', c.reminder_consent
            ) as contacts
          from booking.bookings b
          join booking.contacts c on b.patient_ref = c.patient_ref
          where b.status = 'pending'
          order by b.slot_date asc, b.slot_time asc, b.created_at asc
        `;
        const formatted = pendingBookings.map((b) => ({
          ...b,
          slot_date: b.slot_date instanceof Date ? b.slot_date.toISOString().split('T')[0] : String(b.slot_date).split('T')[0],
          slot_time: String(b.slot_time).slice(0, 5)
        }));
        return res.status(200).json({ bookings: formatted, pendingCount: formatted.length });
      }

      const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
      const days = parseInt(url.searchParams.get('days') || '1', 10);

      // 1. Live slot states via admin_get_slots
      const slotRows = await sql`
        select slot_date, slot_time, state, booking_id
        from booking.admin_get_slots(${from}::date, ${days}::int)
      `;

      // 2. Fetch bookings for range
      const toDate = new Date(`${from}T00:00:00Z`);
      toDate.setDate(toDate.getDate() + days);
      const toDateStr = toDate.toISOString().split('T')[0];

      const bookings = await sql`
        select
          b.id, b.patient_ref, b.treatment, b.slot_date, b.slot_time,
          b.status, b.source, b.notes, b.staff_notes, b.manage_token,
          b.reminder_sent_at, b.created_at,
          json_build_object(
            'full_name', c.full_name,
            'phone', c.phone,
            'email', c.email,
            'reminder_consent', c.reminder_consent
          ) as contacts
        from booking.bookings b
        join booking.contacts c on b.patient_ref = c.patient_ref
        where b.slot_date >= ${from}::date and b.slot_date < ${toDateStr}::date
        order by b.slot_date asc, b.slot_time asc
      `;

      // 3. Fetch slot blocks for range
      const blocks = await sql`
        select id, slot_date, slot_time, reason, created_by, created_at
        from booking.slot_blocks
        where slot_date >= ${from}::date and slot_date < ${toDateStr}::date
        order by slot_date asc
      `;

      // Group slots by date
      const daysMap = new Map();
      const startDate = new Date(`${from}T00:00:00Z`);
      for (let i = 0; i < days; i++) {
        const cur = new Date(startDate);
        cur.setUTCDate(cur.getUTCDate() + i);
        const dateStr = cur.toISOString().split('T')[0];
        const weekdayName = cur.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        daysMap.set(dateStr, {
          date: dateStr,
          weekday: weekdayName,
          availableCount: 0,
          slots: []
        });
      }

      for (const row of slotRows) {
        const dateStr = row.slot_date instanceof Date
          ? row.slot_date.toISOString().split('T')[0]
          : String(row.slot_date).split('T')[0];

        if (daysMap.has(dateStr)) {
          const dObj = daysMap.get(dateStr);
          const timeStr = String(row.slot_time).slice(0, 5);
          const isAvail = row.state === 'available';
          if (isAvail) dObj.availableCount++;

          dObj.slots.push({
            time: timeStr,
            state: row.state,
            available: isAvail,
            bookingId: row.booking_id || null
          });
        }
      }

      const formattedBookings = bookings.map((b) => ({
        ...b,
        slot_date: b.slot_date instanceof Date ? b.slot_date.toISOString().split('T')[0] : String(b.slot_date).split('T')[0],
        slot_time: String(b.slot_time).slice(0, 5)
      }));

      const formattedBlocks = blocks.map((bl) => ({
        ...bl,
        slot_date: bl.slot_date instanceof Date ? bl.slot_date.toISOString().split('T')[0] : String(bl.slot_date).split('T')[0],
        slot_time: bl.slot_time ? String(bl.slot_time).slice(0, 5) : null
      }));

      const [pendingCountRow] = await sql`
        select count(*)::int as count
        from booking.bookings
        where status = 'pending'
      `;
      const pendingCount = pendingCountRow?.count || 0;

      return res.status(200).json({
        days: Array.from(daysMap.values()),
        bookings: formattedBookings,
        blocks: formattedBlocks,
        pendingCount
      });
    }

    // -------------------------------------------------------------------------
    // 4. /api/bookings (all staff) - Manual walk-in
    // -------------------------------------------------------------------------
    if (path === '/bookings' && method === 'POST') {
      const { staff: currentStaff } = await requireStaff(req);
      const { name, phone, email, treatment, date, time, notes, staff_notes } = req.body || {};

      if (!name || !phone || !treatment || !date || !time) {
        return res.status(400).json({ error: 'Name, phone, treatment, date, and time are required.' });
      }

      const cleanPhone = normalisePhone(phone);
      if (!cleanPhone) {
        return res.status(400).json({ error: 'Invalid phone number format.' });
      }

      const sql = getDbFor(currentStaff).booking();

      const [row] = await sql`
        select booking.admin_create_booking(
          ${name.trim()},
          ${cleanPhone},
          ${email ? email.trim() : null},
          ${treatment.trim()},
          ${date}::date,
          ${time}::time,
          ${notes || null},
          ${staff_notes || null}
        ) as res
      `;

      const result = row?.res;
      if (!result?.ok) {
        return res.status(409).json({ code: result?.code || 'SLOT_TAKEN', error: 'Slot not available.' });
      }

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'ADMIN_MANUAL_BOOKING',
        targetType: 'bookings',
        targetId: result.id,
        details: { name, phone: cleanPhone, date, time, treatment }
      });

      return res.status(201).json({ ok: true, id: result.id, manage_token: result.manage_token });
    }

    // PATCH /api/bookings/:id (status / staff_notes / cancellation_reason)
    const bookingMatch = path.match(/^\/bookings\/([a-f0-9-]+)$/i);
    if (bookingMatch && method === 'PATCH') {
      const { staff: currentStaff } = await requireStaff(req);
      const bookingId = bookingMatch[1];
      const { status, staff_notes, cancellation_reason } = req.body || {};

      if (status && !['pending', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
        return res.status(400).json({ error: 'Invalid booking status.' });
      }

      const sql = getDbFor(currentStaff).booking();

      try {
        let updatedBooking;
        try {
          [updatedBooking] = await sql`
            update booking.bookings set
              status = coalesce(${status || null}, status),
              staff_notes = case when ${staff_notes !== undefined} then ${staff_notes} else staff_notes end,
              cancellation_reason = coalesce(${cancellation_reason || null}, cancellation_reason),
              updated_at = now()
            where id = ${bookingId}
            returning *
          `;
        } catch (colErr) {
          if (colErr.code === '42703') { // undefined_column if live DB lacks cancellation_reason
            [updatedBooking] = await sql`
              update booking.bookings set
                status = coalesce(${status || null}, status),
                staff_notes = case
                  when ${staff_notes !== undefined} then ${staff_notes}
                  when ${cancellation_reason !== undefined && cancellation_reason !== null} then coalesce(staff_notes || E'\n', '') || 'Cancellation reason: ' || ${cancellation_reason}
                  else staff_notes
                end,
                updated_at = now()
              where id = ${bookingId}
              returning *
            `;
          } else {
            throw colErr;
          }
        }

        if (!updatedBooking) {
          return res.status(404).json({ error: 'Booking not found.' });
        }

        const auditAction = status === 'confirmed'
          ? 'BOOKING_CONFIRM'
          : status === 'cancelled'
          ? 'BOOKING_CANCEL'
          : 'BOOKING_UPDATE';

        await logBookingAudit({
          staffId: currentStaff.user_id,
          action: auditAction,
          targetType: 'bookings',
          targetId: bookingId,
          details: { status, staff_notes, cancellation_reason }
        });

        return res.status(200).json({ booking: updatedBooking });
      } catch (dbErr) {
        if (dbErr.code === '23505') {
          return res.status(409).json({ code: 'SLOT_TAKEN', error: 'Another booking already occupies this slot.' });
        }
        throw dbErr;
      }
    }

    // POST /api/bookings/:id/reschedule (all staff)
    const rescheduleMatch = path.match(/^\/bookings\/([a-f0-9-]+)\/reschedule$/i);
    if (rescheduleMatch && method === 'POST') {
      const { staff: currentStaff } = await requireStaff(req);
      const bookingId = rescheduleMatch[1];
      const { new_date, new_time } = req.body || {};

      if (!new_date || !new_time) {
        return res.status(400).json({ error: 'new_date and new_time are required.' });
      }

      const sql = getDbFor(currentStaff).booking();

      const [row] = await sql`
        select booking.admin_reschedule_booking(
          ${bookingId}::uuid,
          ${new_date}::date,
          ${new_time}::time
        ) as res
      `;

      const result = row?.res;
      if (!result?.ok) {
        return res.status(409).json({ code: result?.code || 'RESCHEDULE_FAILED', error: 'Reschedule failed.' });
      }

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'BOOKING_RESCHEDULE',
        targetType: 'bookings',
        targetId: bookingId,
        details: { new_date, new_time }
      });

      return res.status(200).json({ ok: true, booking: result });
    }

    // -------------------------------------------------------------------------
    // 5. /api/blocks (admin & doctor)
    // -------------------------------------------------------------------------
    if (path === '/blocks') {
      if (method === 'POST') {
        const { staff: currentStaff } = await requireStaff(req, ['admin', 'doctor']);
        const { date, time, reason, confirm } = req.body || {};

        if (!date) {
          return res.status(400).json({ error: 'Date is required for slot block.' });
        }

        const sql = getDbFor(currentStaff).booking();

        // Check for conflicts
        const conflicts = await sql`
          select b.id, b.slot_date, b.slot_time, b.status, c.full_name, c.phone
          from booking.bookings b
          join booking.contacts c on b.patient_ref = c.patient_ref
          where b.slot_date = ${date}::date
            and b.status in ('pending', 'confirmed')
            ${time ? sql`and b.slot_time = ${time}::time` : sql``}
        `;

        if (conflicts.length > 0 && confirm !== true) {
          return res.status(409).json({
            code: 'CONFLICTING_BOOKINGS',
            count: conflicts.length,
            conflicts,
            message: `Found ${conflicts.length} active booking(s) on this date/time. Pass confirm: true to override and block.`
          });
        }

        const [newBlock] = await sql`
          insert into booking.slot_blocks (slot_date, slot_time, reason, created_by)
          values (
            ${date}::date,
            ${time ? sql`${time}::time` : null},
            ${reason || 'Blocked by clinic staff'},
            ${currentStaff.user_id}
          )
          returning *
        `;

        await logBookingAudit({
          staffId: currentStaff.user_id,
          action: 'SLOT_BLOCK_CREATE',
          targetType: 'slot_blocks',
          targetId: newBlock.id,
          details: { date, time, reason }
        });

        return res.status(201).json({ block: newBlock });
      }
    }

    // DELETE /api/blocks/:id (admin & doctor)
    const blockMatch = path.match(/^\/blocks\/([a-f0-9-]+)$/i);
    if (blockMatch && method === 'DELETE') {
      const { staff: currentStaff } = await requireStaff(req, ['admin', 'doctor']);
      const blockId = blockMatch[1];
      const sql = getDbFor(currentStaff).booking();

      await sql`delete from booking.slot_blocks where id = ${blockId}`;

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'SLOT_BLOCK_DELETE',
        targetType: 'slot_blocks',
        targetId: blockId
      });

      return res.status(200).json({ ok: true, deleted: blockId });
    }

    // -------------------------------------------------------------------------
    // 6. /api/contacts (all staff)
    // -------------------------------------------------------------------------
    if (path === '/contacts' && method === 'GET') {
      const { staff: currentStaff } = await requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      const q = (url.searchParams.get('q') || '').trim();
      const sql = getDbFor(currentStaff).booking();

      let contacts;
      if (q) {
        contacts = await sql`
          select * from booking.contacts
          where full_name ilike ${'%' + q + '%'} or phone ilike ${'%' + q + '%'}
          order by created_at desc
          limit 50
        `;
      } else {
        contacts = await sql`
          select * from booking.contacts
          order by created_at desc
          limit 50
        `;
      }

      return res.status(200).json({ contacts: contacts || [] });
    }

    // GET /api/contacts/:ref (all staff)
    const contactRefMatch = path.match(/^\/contacts\/([a-f0-9-]+)$/i);
    if (contactRefMatch && method === 'GET') {
      const { staff: currentStaff } = await requireStaff(req);
      const patientRef = contactRefMatch[1];
      const sql = getDbFor(currentStaff).booking();

      const [contact] = await sql`
        select * from booking.contacts
        where patient_ref = ${patientRef}
      `;

      if (!contact) {
        return res.status(404).json({ error: 'Patient contact record not found.' });
      }

      const bookings = await sql`
        select * from booking.bookings
        where patient_ref = ${patientRef}
        order by slot_date desc, slot_time desc
      `;

      const formattedBookings = bookings.map((b) => ({
        ...b,
        slot_date: b.slot_date instanceof Date ? b.slot_date.toISOString().split('T')[0] : String(b.slot_date).split('T')[0],
        slot_time: String(b.slot_time).slice(0, 5)
      }));

      return res.status(200).json({ contact, bookings: formattedBookings });
    }

    // PATCH /api/contacts/:ref/consent (all staff)
    const consentMatch = path.match(/^\/contacts\/([a-f0-9-]+)\/consent$/i);
    if (consentMatch && method === 'PATCH') {
      const { staff: currentStaff } = await requireStaff(req);
      const patientRef = consentMatch[1];
      const { reminder_consent } = req.body || {};
      const sql = getDbFor(currentStaff).booking();

      const [updatedContact] = await sql`
        update booking.contacts set
          reminder_consent = ${Boolean(reminder_consent)},
          consent_updated_at = now()
        where patient_ref = ${patientRef}
        returning *
      `;

      if (!updatedContact) {
        return res.status(404).json({ error: 'Patient contact not found.' });
      }

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'CONSENT_UPDATE',
        targetType: 'contacts',
        targetId: patientRef,
        details: { reminder_consent }
      });

      return res.status(200).json({ contact: updatedContact });
    }

    // -------------------------------------------------------------------------
    // 7. /api/reminders (all staff)
    // -------------------------------------------------------------------------
    if (path === '/reminders' && method === 'GET') {
      const { staff: currentStaff } = await requireStaff(req);
      const sql = getDbFor(currentStaff).booking();

      // Tomorrow in IST
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const tomorrowIst = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);

      // Tab 1: Tomorrow's appointments needing reminder
      const apptBookings = await sql`
        select
          b.id, b.patient_ref, b.treatment, b.slot_date, b.slot_time,
          b.status, b.reminder_sent_at,
          json_build_object(
            'full_name', c.full_name,
            'phone', c.phone,
            'reminder_consent', c.reminder_consent
          ) as contacts
        from booking.bookings b
        join booking.contacts c on b.patient_ref = c.patient_ref
        where b.slot_date = ${tomorrowIst}::date
          and b.status in ('pending', 'confirmed')
        order by b.slot_time asc
      `;

      const formattedAppts = apptBookings.map((b) => ({
        ...b,
        slot_date: b.slot_date instanceof Date ? b.slot_date.toISOString().split('T')[0] : String(b.slot_date).split('T')[0],
        slot_time: String(b.slot_time).slice(0, 5)
      }));

      // Tabs 2 & 3: Encapsulated via ReminderService (Step 5)
      const reminderSvc = remindersFor(currentStaff);
      const followupsDue = await reminderSvc.getFollowUpRemindersDue();
      const activeMedications = await reminderSvc.getActiveMedicationChecks();

      return res.status(200).json({
        appointmentsTomorrow: formattedAppts,
        followupsDue,
        activeMedications
      });
    }

    // POST /api/reminders/log (mark reminder sent)
    if (path === '/reminders/log' && method === 'POST') {
      const { staff: currentStaff } = await requireStaff(req);
      const { patient_ref, channel = 'whatsapp', reminder_type, booking_id, notes } = req.body || {};

      if (!patient_ref || !reminder_type) {
        return res.status(400).json({ error: 'patient_ref and reminder_type are required.' });
      }

      const sql = getDbFor(currentStaff).booking();

      // If appointment reminder, mark reminder_sent_at
      if (reminder_type === 'appointment' && booking_id) {
        await sql`
          update booking.bookings set reminder_sent_at = now()
          where id = ${booking_id}
        `;
      }

      // Log to clinical.reminder_log via ReminderService
      const reminderSvc = remindersFor(currentStaff);
      await reminderSvc.logReminderSent({
        patientRef: patient_ref,
        channel,
        reminderType: reminder_type,
        payload: { booking_id, notes }
      });

      await logBookingAudit({
        staffId: currentStaff.user_id,
        action: 'REMINDER_LOGGED',
        targetType: 'reminders',
        targetId: booking_id || patient_ref,
        details: { reminder_type, channel }
      });

      return res.status(200).json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 8. /api/clinical/* (DOCTOR & ADMIN ONLY)
    // Step 5: Second layer of defense - Handled via patientRecordsFor(staff).
    // Reception role receives HTTP 403 Forbidden.
    // -------------------------------------------------------------------------
    if (path.startsWith('/clinical')) {
      const { staff: currentStaff } = await requireStaff(req, ['admin', 'doctor']);
      const patientRecords = patientRecordsFor(currentStaff);

      // POST /api/clinical/patients/open
      if (path === '/clinical/patients/open' && method === 'POST') {
        const { patient_ref, date_of_birth, gender } = req.body || {};
        if (!patient_ref) {
          return res.status(400).json({ error: 'patient_ref is required.' });
        }

        const profile = await patientRecords.openProfile(patient_ref, { date_of_birth, gender });
        return res.status(200).json({ profile });
      }

      // GET /api/clinical/patients/:ref
      const clinicalPatientMatch = path.match(/^\/clinical\/patients\/([a-f0-9-]+)$/i);
      if (clinicalPatientMatch && method === 'GET') {
        const patientRef = clinicalPatientMatch[1];
        const profile = await patientRecords.getProfile(patientRef);
        const consultations = await patientRecords.getConsultations(patientRef);
        const medications = await patientRecords.getMedications(patientRef);

        return res.status(200).json({
          profile,
          consultations,
          medications
        });
      }

      // PATCH /api/clinical/patients/:ref
      if (clinicalPatientMatch && method === 'PATCH') {
        const patientRef = clinicalPatientMatch[1];
        const profile = await patientRecords.updateProfile(patientRef, req.body || {});
        return res.status(200).json({ profile });
      }

      // POST /api/clinical/consultations
      if (path === '/clinical/consultations' && method === 'POST') {
        const { patient_ref, chief_complaint } = req.body || {};
        if (!patient_ref || !chief_complaint) {
          return res.status(400).json({ error: 'patient_ref and chief_complaint are required.' });
        }

        const consult = await patientRecords.createConsultation(patient_ref, req.body || {});
        return res.status(201).json({ consultation: consult });
      }

      // PATCH /api/clinical/consultations/:id
      const consultMatch = path.match(/^\/clinical\/consultations\/([a-f0-9-]+)$/i);
      if (consultMatch && method === 'PATCH') {
        const consultId = consultMatch[1];
        const consult = await patientRecords.updateConsultation(consultId, req.body || {});
        return res.status(200).json({ consultation: consult });
      }

      // POST /api/clinical/medications
      if (path === '/clinical/medications' && method === 'POST') {
        const { patient_ref, name, dosage, frequency } = req.body || {};
        if (!patient_ref || !name || !dosage || !frequency) {
          return res.status(400).json({ error: 'patient_ref, name, dosage, and frequency are required.' });
        }

        const med = await patientRecords.createMedication(patient_ref, req.body || {});
        return res.status(201).json({ medication: med });
      }

      // PATCH /api/clinical/medications/:id
      const medMatch = path.match(/^\/clinical\/medications\/([a-f0-9-]+)$/i);
      if (medMatch && method === 'PATCH') {
        const medId = medMatch[1];
        const med = await patientRecords.updateMedication(medId, req.body || {});
        return res.status(200).json({ medication: med });
      }

      // POST /api/clinical/patients/:ref/erase (ADMIN ONLY - Right to be Forgotten)
      const eraseMatch = path.match(/^\/clinical\/patients\/([a-f0-9-]+)\/erase$/i);
      if (eraseMatch && method === 'POST') {
        const { staff: currentAdmin } = await requireStaff(req, ['admin']);
        const patientRef = eraseMatch[1];

        // 1. Purge clinical records
        await patientRecords.erasePatientData(patientRef);

        // 2. Anonymize contact & clear booking notes in booking schema
        const sql = getDbFor(currentAdmin).booking();
        await sql`
          update booking.contacts set
            full_name = 'Anonymized Patient',
            phone = '+910000000000',
            email = null,
            reminder_consent = false
          where patient_ref = ${patientRef}
        `;

        await sql`
          update booking.bookings set
            notes = null,
            staff_notes = 'Patient records erased under DPDP right-to-be-forgotten request.'
          where patient_ref = ${patientRef}
        `;

        await logBookingAudit({
          staffId: currentAdmin.user_id,
          action: 'PATIENT_RIGHT_TO_ERASURE',
          targetType: 'clinical.clinical_patients',
          targetId: patientRef,
          details: { request: 'GDPR/DPDP erasure' }
        });

        return res.status(200).json({ ok: true, erased: patientRef });
      }
    }

    // -------------------------------------------------------------------------
    // 9. /api/audit (admin only)
    // -------------------------------------------------------------------------
    if (path === '/audit' && method === 'GET') {
      const { staff: currentStaff } = await requireStaff(req, ['admin']);
      const sqlBooking = getDbFor(currentStaff).booking();
      const sqlClinical = getDbFor(currentStaff).clinical();

      const bookingAudit = await sqlBooking`
        select * from booking.audit_log
        order by created_at desc
        limit 100
      `;

      let clinicalAudit = [];
      try {
        clinicalAudit = await sqlClinical`
          select * from clinical.access_log
          order by accessed_at desc
          limit 100
        `;
      } catch (_) {}

      return res.status(200).json({
        bookingAudit: bookingAudit || [],
        clinicalAudit: clinicalAudit || []
      });
    }

    return res.status(404).json({ error: `Not found: ${method} ${path}` });
  } catch (err) {
    console.error(`[Admin API Error] ${method} ${path}:`, err);
    const status = err.status || (err.name === 'ForbiddenError' ? 403 : err.name === 'UnauthorizedError' ? 401 : 500);
    return res.status(status).json({
      error: err.message || 'Internal server error.',
      code: err.code || 'SERVER_ERROR'
    });
  }
}
