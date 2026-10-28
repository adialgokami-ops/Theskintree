/**
 * Email notifications via Resend REST API (native fetch, no heavy SDK).
 * Hard Rule 6: Notifications must never fail or undo a booking. Always log and continue.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Notify] RESEND_API_KEY is not configured; skipping email delivery.');
    return { ok: false, skipped: true };
  }

  const fromEmail = process.env.CLINIC_EMAIL || 'concierge@theskintree.in';

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `The Skin Tree <${fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[Notify] Resend delivery failed (HTTP ${res.status}):`, errBody);
      return { ok: false, error: errBody };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    console.error('[Notify] Network error sending email via Resend:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendBookingConfirmationToPatient({
  patientEmail,
  patientName,
  treatment,
  date,
  time,
  manageToken
}) {
  if (!patientEmail) return { ok: false, skipped: true };

  const siteUrl = process.env.SITE_URL || 'https://theskintree.in';
  const manageUrl = `${siteUrl}/manage/${manageToken}`;
  const firstName = (patientName || 'Patient').split(' ')[0];

  const subject = `Your Consultation at The Skin Tree — ${date} at ${time}`;
  const text = `Hello ${firstName},

Your consultation appointment at The Skin Tree has been received.

Appointment Details:
- Doctor: Dr. Aishwarya Agarwal
- Focus: ${treatment}
- Date: ${date}
- Time: ${time}
- Location: 123 Serenity Lane, Bandra West, Mumbai

Need to reschedule or cancel? You can manage your appointment anytime using your private link:
${manageUrl}

Warm regards,
The Skin Tree Team`;

  const waNum = process.env.CLINIC_WHATSAPP;
  if (!waNum) {
    console.error('🚨 [CRITICAL CONFIG WARNING] CLINIC_WHATSAPP environment variable is not configured!');
  }
  const waHelp = waNum
    ? `If you need immediate assistance, reach our concierge on WhatsApp at ${waNum}.`
    : 'If you need immediate assistance, reply to this email or reach our clinic concierge.';

  const html = `
<div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2C1810; max-width: 600px; margin: 0 auto; padding: 24px; background: #FCFAF7; border-radius: 12px; border: 1px solid #E2CEBC;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="font-family: Georgia, serif; color: #3D1E16; margin: 0; font-size: 24px;">The Skin Tree</h2>
    <p style="color: #b25936; margin: 4px 0 0 0; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase;">Medical Dermatology & Aesthetics</p>
  </div>
  
  <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${firstName}</strong>,</p>
  <p style="font-size: 15px; line-height: 1.6; color: #5C2E20;">
    Your consultation request with <strong>Dr. Aishwarya Agarwal</strong> has been successfully received.
  </p>

  <div style="background: #FFFFFF; border: 1px solid #D4B896; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <h4 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #b25936;">Consultation Summary</h4>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Consultation Focus:</strong> ${treatment}</p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Date:</strong> ${date}</p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Time Slot:</strong> ${time} IST</p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Sanctuary:</strong> Bandra West, Mumbai</p>
  </div>

  <div style="text-align: center; margin: 28px 0;">
    <a href="${manageUrl}" style="background: #b25936; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 14px; display: inline-block;">Manage or Reschedule Appointment</a>
  </div>

  <p style="font-size: 13px; color: #9B7462; line-height: 1.5; border-top: 1px solid #E2CEBC; padding-top: 16px;">
    Please arrive 10 minutes prior to your slot. ${waHelp}
  </p>
</div>`;

  return sendEmail({ to: patientEmail, subject, html, text });
}

export async function sendBookingNotificationToClinic({
  patientName,
  phone,
  treatment,
  date,
  time,
  notes,
  source
}) {
  const clinicEmail = process.env.CLINIC_EMAIL;
  if (!clinicEmail) return { ok: false, skipped: true };

  const subject = `[New Booking] ${patientName} — ${date} ${time} (${source})`;
  const text = `New Booking Received:
Patient: ${patientName}
Phone: ${phone}
Focus: ${treatment}
Date: ${date} at ${time}
Source: ${source}
Notes: ${notes || 'None'}`;

  const html = `
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h3>New Consultation Booking Registered</h3>
  <ul>
    <li><strong>Patient:</strong> ${patientName}</li>
    <li><strong>Phone:</strong> ${phone}</li>
    <li><strong>Focus:</strong> ${treatment}</li>
    <li><strong>Date & Time:</strong> ${date} at ${time}</li>
    <li><strong>Source:</strong> ${source}</li>
    <li><strong>Notes:</strong> ${notes || 'None'}</li>
  </ul>
</div>`;

  return sendEmail({ to: clinicEmail, subject, html, text });
}

export async function sendReminderEmailToPatient({
  patientEmail,
  patientName,
  slotDate,
  slotTime
}) {
  if (!patientEmail) return { ok: false, skipped: true };

  const firstName = (patientName || 'there').split(' ')[0];
  const subject = `Reminder: Your Consultation Tomorrow at The Skin Tree`;
  const text = `Hello ${firstName}, this is a gentle reminder of your consultation at The Skin Tree tomorrow at ${slotTime}.`;
  const html = `<p>${text}</p>`;

  return sendEmail({ to: patientEmail, subject, html, text });
}
