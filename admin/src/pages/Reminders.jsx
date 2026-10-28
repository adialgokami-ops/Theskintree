import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buildReminderMessage } from '@theskintree/shared'

export default function Reminders() {
  const { authFetch, staff } = useAuth()
  const [activeTab, setActiveTab] = useState('tomorrow') // 'tomorrow' | 'followup' | 'meds'
  const [reminderData, setReminderData] = useState({
    appointmentsTomorrow: [],
    followupsDue: [],
    activeMedications: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadReminders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/reminders')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load reminders.')
      setReminderData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleSendWhatsApp = (type, item) => {
    let msg = ''
    let phone = ''
    let bookingId = null
    const patientRef = item.patient_ref

    if (type === 'appointment') {
      const patientName = item.contacts?.full_name || 'Valued Patient'
      phone = (item.contacts?.phone || '').replace(/\D/g, '')
      bookingId = item.id
      msg = buildReminderMessage('appointment', {
        patientName,
        date: item.slot_date,
        time: item.slot_time
      })
    } else if (type === 'followup') {
      phone = '' // Clinical record has patient_ref
      msg = buildReminderMessage('followup', {
        patientName: 'Valued Patient',
        date: item.follow_up_date
      })
    } else if (type === 'medication') {
      msg = buildReminderMessage('medicine', {
        patientName: 'Valued Patient'
      })
    }

    if (!phone && item.contacts?.phone) {
      phone = item.contacts.phone.replace(/\D/g, '')
    }

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    window.open(waUrl, '_blank')
  }

  const handleMarkSent = async (type, item) => {
    setActionLoading(true)
    try {
      const res = await authFetch('/api/reminders/log', {
        method: 'POST',
        body: JSON.stringify({
          patient_ref: item.patient_ref,
          reminder_type: type,
          booking_id: item.id || null,
          channel: 'whatsapp'
        })
      })
      if (!res.ok) throw new Error('Failed to log reminder')

      // Mark locally
      if (type === 'appointment') {
        setReminderData((prev) => ({
          ...prev,
          appointmentsTomorrow: prev.appointmentsTomorrow.map((b) =>
            b.id === item.id ? { ...b, reminder_sent_at: new Date().toISOString() } : b
          )
        }))
      }
      alert('Reminder marked as sent.')
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="admin-content">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem' }}>Patient Reminders & Outreach</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
          Privacy-first automated WhatsApp concierge. Health diagnoses and pharmaceutical details are never included.
        </p>
      </div>

      {error && (
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('tomorrow')}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'tomorrow' ? '3px solid var(--color-forest)' : '3px solid transparent',
            color: activeTab === 'tomorrow' ? 'var(--color-forest)' : 'var(--color-text-muted)'
          }}
        >
          📅 Tomorrow's Appointments ({reminderData.appointmentsTomorrow?.length || 0})
        </button>

        {['admin', 'doctor'].includes(staff?.role) && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('followup')}
              style={{
                padding: '0.75rem 1.5rem',
                fontWeight: 600,
                fontSize: '0.95rem',
                borderBottom: activeTab === 'followup' ? '3px solid var(--color-forest)' : '3px solid transparent',
                color: activeTab === 'followup' ? 'var(--color-forest)' : 'var(--color-text-muted)'
              }}
            >
              🔄 Follow-ups Due ({reminderData.followupsDue?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('meds')}
              style={{
                padding: '0.75rem 1.5rem',
                fontWeight: 600,
                fontSize: '0.95rem',
                borderBottom: activeTab === 'meds' ? '3px solid var(--color-forest)' : '3px solid transparent',
                color: activeTab === 'meds' ? 'var(--color-forest)' : 'var(--color-text-muted)'
              }}
            >
              💊 Active Regimens ({reminderData.activeMedications?.length || 0})
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
          Loading reminders queue...
        </div>
      ) : activeTab === 'tomorrow' ? (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {reminderData.appointmentsTomorrow.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No appointments scheduled for tomorrow in IST.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time Slot</th>
                  <th>Patient Name</th>
                  <th>Phone Number</th>
                  <th>Treatment Focus</th>
                  <th>Consent Status</th>
                  <th>Reminder Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminderData.appointmentsTomorrow.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-forest)' }}>{b.slot_time}</td>
                    <td>
                      <Link to={`/patients/${b.patient_ref}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                        {b.contacts?.full_name}
                      </Link>
                    </td>
                    <td>{b.contacts?.phone}</td>
                    <td>{b.treatment}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          background: b.contacts?.reminder_consent ? '#DEF7EC' : '#FFF5F5',
                          color: b.contacts?.reminder_consent ? '#03543F' : '#C53030',
                          fontWeight: 600
                        }}
                      >
                        {b.contacts?.reminder_consent ? '✓ Consented' : 'Opt-Out'}
                      </span>
                    </td>
                    <td>
                      {b.reminder_sent_at ? (
                        <span style={{ fontSize: '0.75rem', color: '#03543F', fontWeight: 600 }}>
                          ✓ Sent {new Date(b.reminder_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#C05621', fontWeight: 600 }}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#25D366', color: '#FFFFFF', borderColor: '#25D366', fontWeight: 600 }}
                          onClick={() => handleSendWhatsApp('appointment', b)}
                        >
                          💬 WhatsApp
                        </button>
                        {!b.reminder_sent_at && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => handleMarkSent('appointment', b)}
                            disabled={actionLoading}
                          >
                            Mark Sent
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === 'followup' ? (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {reminderData.followupsDue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No follow-ups due at this time.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Patient Ref</th>
                  <th>Chief Concern</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminderData.followupsDue.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{f.follow_up_date}</td>
                    <td>
                      <Link to={`/patients/${f.patient_ref}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                        View Patient Profile
                      </Link>
                    </td>
                    <td>{f.chief_complaint}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => handleSendWhatsApp('followup', f)}
                      >
                        💬 Send Follow-Up Prompt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {reminderData.activeMedications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
              No ongoing active regimens.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Patient Ref</th>
                  <th>Prescription Name</th>
                  <th>Dosage / Frequency</th>
                  <th>Started</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminderData.activeMedications.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link to={`/patients/${m.patient_ref}`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                        View Patient Chart
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.dosage} ({m.frequency})</td>
                    <td>{m.start_date}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => handleSendWhatsApp('medication', m)}
                      >
                        💬 Generic Refill Check
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
