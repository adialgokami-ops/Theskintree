/**
 * Reminder message builder for The Skin Tree
 * Privacy & discretion rule: NEVER include medical diagnoses, treatments, or medicine names.
 */

export function buildReminderMessage({ kind, firstName = 'there', slotTime, dueDate }) {
  const cleanName = (firstName || 'there').trim();

  switch (kind) {
    case 'appointment':
      return `Hello ${cleanName}, this is a gentle reminder of your upcoming consultation at The Skin Tree tomorrow at ${slotTime || 'your scheduled time'}.`;

    case 'followup':
      return `Hello ${cleanName}, this is a gentle reminder from The Skin Tree regarding your scheduled follow-up window. Please contact us to arrange your visit.`;

    case 'medicine':
      return `Hello ${cleanName}, this is a gentle reminder from The Skin Tree concerning your active prescription cycle. Please reach out to our clinic team regarding your refill schedule.`;

    default:
      return `Hello ${cleanName}, a reminder from The Skin Tree regarding your consultation schedule. Please call or WhatsApp our clinic if you have any questions.`;
  }
}
