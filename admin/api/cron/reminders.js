/**
 * Daily Appointment Reminders Cron: /api/cron/reminders
 * Runs daily at 03:30 UTC (09:00 IST).
 * Protected by Bearer CRON_SECRET.
 * Queries booking database for tomorrow's appointments needing reminders.
 */

import { getDbFor } from '../../server/lib/db.js';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret.' });
  }

  try {
    const sql = getDbFor({ role: 'admin' }).booking();

    // Tomorrow in IST
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrowIst = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);

    const pendingAppointments = await sql`
      select
        b.id, b.slot_date, b.slot_time, b.treatment, b.manage_token,
        c.full_name, c.email, c.phone, c.reminder_consent
      from booking.bookings b
      join booking.contacts c on b.patient_ref = c.patient_ref
      where b.slot_date = ${tomorrowIst}::date
        and b.status in ('pending', 'confirmed')
        and b.reminder_sent_at is null
        and c.reminder_consent = true
        and c.email is not null
    `;

    const resendKey = process.env.RESEND_API_KEY;
    const clinicEmail = process.env.CLINIC_EMAIL || 'concierge@theskintree.in';
    let sentCount = 0;
    let errorCount = 0;

    for (const appt of pendingAppointments) {
      if (!resendKey) {
        console.warn('[Reminders Cron] RESEND_API_KEY not set; skipping email send.');
        break;
      }

      try {
        const timeFormatted = String(appt.slot_time).slice(0, 5);
        const emailBody = `
          <div style="font-family: sans-serif; color: #2D3748; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B3B2B;">The Skin Tree Sanctuary</h2>
            <p>Dear ${appt.full_name},</p>
            <p>This is a gentle reminder of your upcoming consultation with Dr. Aishwarya Agarwal:</p>
            <div style="background: #FAF8F5; border: 1px solid #E2E8F0; padding: 1.25rem; border-radius: 8px; margin: 1.5rem 0;">
              <p style="margin: 0 0 8px;"><strong>Treatment:</strong> ${appt.treatment}</p>
              <p style="margin: 0 0 8px;"><strong>Date:</strong> Tomorrow, ${appt.slot_date}</p>
              <p style="margin: 0 0 8px;"><strong>Time:</strong> ${timeFormatted} IST</p>
              <p style="margin: 0;"><strong>Sanctuary:</strong> The Skin Tree, Bandra West, Mumbai</p>
            </div>
            <p style="font-size: 0.85rem; color: #718096;">
              Need to reschedule or adjust? <a href="${process.env.SITE_URL || 'https://theskintree.in'}/manage/${appt.manage_token}" style="color: #1B3B2B;">Manage your appointment here</a>.
            </p>
          </div>
        `;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: `The Skin Tree Concierge <${clinicEmail}>`,
            to: [appt.email],
            subject: `Appointment Reminder: Tomorrow at ${timeFormatted} - The Skin Tree`,
            html: emailBody
          })
        });

        if (resp.ok) {
          sentCount++;
          await sql`
            update booking.bookings set reminder_sent_at = now()
            where id = ${appt.id}
          `;
        } else {
          errorCount++;
          console.error(`[Reminders Cron] Failed sending to ${appt.email}:`, await resp.text());
        }
      } catch (sendErr) {
        errorCount++;
        console.error(`[Reminders Cron] Exception sending to ${appt.email}:`, sendErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      date: tomorrowIst,
      candidateCount: pendingAppointments.length,
      sentCount,
      errorCount
    });
  } catch (err) {
    console.error('[Reminders Cron Error]:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
