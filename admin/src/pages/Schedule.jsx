import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TREATMENTS } from '@theskintree/shared'

function getTodayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export default function Schedule() {
  const { authFetch, staff } = useAuth()

  const [viewMode, setViewMode] = useState('day') // 'day', 'week', or 'pending'
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [scheduleData, setScheduleData] = useState({ days: [], bookings: [], blocks: [] })
  const [pendingBookings, setPendingBookings] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modals state
  const [walkInModal, setWalkInModal] = useState(null) // { date, time }
  const [bookingDetailModal, setBookingDetailModal] = useState(null) // booking object
  const [rescheduleModal, setRescheduleModal] = useState(null) // { bookingId, currentDate, currentTime }
  const [blockModal, setBlockModal] = useState(false)
  const [conflictPrompt, setConflictPrompt] = useState(null)

  // Walk-In form state
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInEmail, setWalkInEmail] = useState('')
  const [walkInTreatment, setWalkInTreatment] = useState(TREATMENTS[0]?.name || 'Bespoke Consultation')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInStaffNotes, setWalkInStaffNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Reschedule state
  const [reschedDate, setReschedDate] = useState('')
  const [reschedTime, setReschedTime] = useState('')

  // Block state
  const [blockDate, setBlockDate] = useState(getTodayStr())
  const [blockTime, setBlockTime] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (viewMode === 'pending') {
        const res = await authFetch('/api/schedule?pending=1')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load pending queue.')
        setPendingBookings(data.bookings || [])
        setPendingCount(data.pendingCount !== undefined ? data.pendingCount : (data.bookings || []).length)
      } else {
        const daysCount = viewMode === 'week' ? 7 : 1
        const res = await authFetch(`/api/schedule?from=${selectedDate}&days=${daysCount}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load schedule.')
        setScheduleData(data)
        if (data.pendingCount !== undefined) {
          setPendingCount(data.pendingCount)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authFetch, selectedDate, viewMode])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  // Date Navigation
  const handlePrev = () => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() - (viewMode === 'week' ? 7 : 1))
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleNext = () => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() + (viewMode === 'week' ? 7 : 1))
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Handle Walk-In Booking Submit
  const handleWalkInSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          name: walkInName,
          phone: walkInPhone,
          email: walkInEmail,
          treatment: walkInTreatment,
          date: walkInModal.date,
          time: walkInModal.time,
          notes: walkInNotes,
          staff_notes: walkInStaffNotes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to book walk-in.')
      setWalkInModal(null)
      setWalkInName('')
      setWalkInPhone('')
      setWalkInEmail('')
      setWalkInNotes('')
      setWalkInStaffNotes('')
      await loadSchedule()
    } catch (err) {
      alert(`Booking error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Booking Status Update
  const handleUpdateStatus = async (bookingId, newStatus, reason = null) => {
    setActionLoading(true)
    try {
      const body = { status: newStatus }
      if (reason) body.cancellation_reason = reason
      const res = await authFetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update status.')
      if (bookingDetailModal) {
        setBookingDetailModal({ ...bookingDetailModal, status: newStatus })
      }
      await loadSchedule()
    } catch (err) {
      alert(`Status update error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Booking Cancellation with Mandatory Reason
  const handleCancelWithReason = async (bookingId) => {
    const reason = window.prompt('Please enter the reason for cancellation (e.g., Patient unreachable, requested cancellation, duplicate request):')
    if (reason === null) return // Cancelled prompt
    if (!reason.trim()) {
      alert('Cancellation reason is required.')
      return
    }
    await handleUpdateStatus(bookingId, 'cancelled', reason.trim())
  }

  // Handle Staff Notes Update
  const handleSaveStaffNotes = async (bookingId, staffNotes) => {
    setActionLoading(true)
    try {
      const res = await authFetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ staff_notes: staffNotes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update notes.')
      await loadSchedule()
      alert('Staff notes saved.')
    } catch (err) {
      alert(`Error saving notes: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Reschedule Submit
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const res = await authFetch(`/api/bookings/${rescheduleModal.bookingId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ new_date: reschedDate, new_time: reschedTime })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reschedule.')
      setRescheduleModal(null)
      setBookingDetailModal(null)
      await loadSchedule()
    } catch (err) {
      alert(`Reschedule error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Slot Block Submit (with conflict check)
  const handleBlockSubmit = async (overrideConfirm = false) => {
    setActionLoading(true)
    try {
      const res = await authFetch('/api/blocks', {
        method: 'POST',
        body: JSON.stringify({
          date: blockDate,
          time: blockTime || null,
          reason: blockReason,
          confirm: overrideConfirm
        })
      })
      const data = await res.json()
      if (res.status === 409 && data.code === 'CONFLICTING_BOOKINGS') {
        setConflictPrompt(data)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to block slot.')
      setBlockModal(false)
      setConflictPrompt(null)
      setBlockReason('')
      setBlockTime('')
      await loadSchedule()
    } catch (err) {
      alert(`Block error: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Delete Block
  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Are you sure you want to unblock this slot?')) return
    try {
      const res = await authFetch(`/api/blocks/${blockId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to unblock.')
      await loadSchedule()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="admin-content">
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.8rem' }}>Clinic Schedule</h1>
          <div style={{ display: 'inline-flex', background: '#EDF2F7', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'day' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'day' ? 'var(--color-forest)' : '#718096',
                boxShadow: viewMode === 'day' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'week' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'week' ? 'var(--color-forest)' : '#718096',
                boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pending')}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'pending' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'pending' ? 'var(--color-forest)' : '#718096',
                boxShadow: viewMode === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Pending Queue</span>
              {pendingCount > 0 && (
                <span style={{
                  background: 'var(--color-gold, #D97706)',
                  color: '#FFFFFF',
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontWeight: 700
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {viewMode !== 'pending' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setSelectedDate(getTodayStr())}>
              Today
            </button>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#FFFFFF' }}>
              <button type="button" onClick={handlePrev} style={{ padding: '0.5rem 0.8rem', fontSize: '1rem' }}>
                ‹
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: 'none', padding: '0.5rem 0.5rem', fontSize: '0.9rem', outline: 'none' }}
              />
              <button type="button" onClick={handleNext} style={{ padding: '0.5rem 0.8rem', fontSize: '1rem' }}>
                ›
              </button>
            </div>

            {['admin', 'doctor'].includes(staff?.role) && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setBlockDate(selectedDate)
                  setBlockModal(true)
                }}
              >
                🚫 Block Slot / Day
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={loadSchedule} disabled={loading}>
              🔄 Refresh Queue
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="warning-box" style={{ background: '#FFF5F5', borderColor: '#FEB2B2', color: '#C53030' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-muted)' }}>
          Loading schedule...
        </div>
      ) : viewMode === 'pending' ? (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-forest)', marginBottom: '4px' }}>
              Pending Confirmation Queue
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Appointments requested via website or chat. Call or WhatsApp the patient to confirm availability before confirming.
            </p>
          </div>

          {pendingBookings.length === 0 ? (
            <div className="admin-card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-forest)', marginBottom: '0.25rem' }}>All Caught Up</h3>
              <p style={{ fontSize: '0.85rem' }}>There are no pending booking requests waiting for confirmation.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingBookings.map((b) => (
                <div key={b.id} className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--color-gold, #D97706)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className="status-pill pending" style={{ background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                          Pending Confirmation
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                          Source: <code>{b.source}</code>
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--color-forest)', marginBottom: '4px' }}>
                        <Link to={`/patients/${b.patient_ref}`} style={{ textDecoration: 'underline' }}>
                          {b.contacts?.full_name || 'Patient'}
                        </Link>
                      </h3>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2D3748', marginBottom: '6px' }}>
                        {b.treatment}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#4A5568', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span>📅 <strong>{b.slot_date}</strong> at <strong>{b.slot_time}</strong></span>
                        <span>📞 <a href={`tel:${b.contacts?.phone}`} style={{ color: 'var(--color-forest)', textDecoration: 'underline' }}>{b.contacts?.phone}</a></span>
                        {b.contacts?.email && <span>✉️ {b.contacts?.email}</span>}
                      </div>
                      {b.notes && (
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', background: '#F7FAFC', padding: '6px 10px', borderRadius: '4px', border: '1px solid #EDF2F7' }}>
                          <strong>Patient Notes:</strong> {b.notes}
                        </div>
                      )}
                      {b.staff_notes && (
                        <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#4A5568' }}>
                          <strong>Staff Notes:</strong> {b.staff_notes}
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: '#A0AEC0', marginTop: '6px' }}>
                        Requested on: {new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px' }}>
                      <a
                        href={`https://wa.me/${(b.contacts?.phone || '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                        style={{ textAlign: 'center', justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#25D366', color: '#FFFFFF', borderColor: '#25D366' }}
                      >
                        💬 WhatsApp
                      </a>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                        onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                        disabled={actionLoading}
                      >
                        ✓ Confirm Booking
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                        onClick={() => handleCancelWithReason(b.id)}
                        disabled={actionLoading}
                      >
                        ✕ Cancel Request
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scheduleData.days?.length || 1}, minmax(280px, 1fr))`, gap: '1.25rem' }}>
          {scheduleData.days?.map((day) => {
            const dayBookings = (scheduleData.bookings || []).filter((b) => b.slot_date === day.date)
            const dayBlocks = (scheduleData.blocks || []).filter((b) => b.slot_date === day.date)
            const isFullDayBlocked = dayBlocks.some((b) => !b.slot_time)

            return (
              <div key={day.date} className="admin-card" style={{ padding: '1rem' }}>
                <div style={{ borderBottom: '2px solid var(--color-forest)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-gold)', fontWeight: 600 }}>
                    {day.weekday}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginTop: '2px' }}>{day.date}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {isFullDayBlocked ? (
                      <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Whole Day Blocked</span>
                    ) : (
                      `${day.availableCount} open slot(s)`
                    )}
                  </div>
                </div>

                {isFullDayBlocked && (
                  <div style={{ background: '#FFF5F5', border: '1px dashed #FEB2B2', padding: '1rem', borderRadius: '6px', textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#C53030' }}>Clinic Closed / Blocked</div>
                    <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '4px' }}>
                      {dayBlocks.find((b) => !b.slot_time)?.reason || 'Staff blocked day'}
                    </div>
                    {['admin', 'doctor'].includes(staff?.role) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(dayBlocks.find((b) => !b.slot_time).id)}
                        style={{ marginTop: '8px', fontSize: '0.75rem', color: '#C53030', textDecoration: 'underline' }}
                      >
                        Remove Block
                      </button>
                    )}
                  </div>
                )}

                {/* Slots List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {day.slots?.map((slot) => {
                    const booking = dayBookings.find(
                      (b) => b.slot_time.startsWith(slot.time) && ['pending', 'confirmed'].includes(b.status)
                    )
                    const slotBlock = dayBlocks.find(
                      (b) => b.slot_time && b.slot_time.startsWith(slot.time)
                    )

                    return (
                      <div
                        key={slot.time}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '0.85rem',
                          background: booking ? '#FFFFFF' : slotBlock ? '#FFF5F5' : '#F9FBF9',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-forest)' }}>
                            {slot.time}
                          </span>
                          {booking && (
                            <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                          )}
                          {slotBlock && (
                            <span style={{ fontSize: '0.7rem', background: '#FED7D7', color: '#9B1C1C', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                              Blocked
                            </span>
                          )}
                          {!booking && !slotBlock && !isFullDayBlocked && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>
                              Available
                            </span>
                          )}
                        </div>

                        {booking ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-forest)' }}>
                              <Link to={`/patients/${booking.patient_ref}`} style={{ textDecoration: 'underline' }}>
                                {booking.contacts?.full_name || 'Patient'}
                              </Link>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              {booking.treatment}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '2px' }}>
                              📞 {booking.contacts?.phone}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '8px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => setBookingDetailModal(booking)}
                              >
                                Manage Booking
                              </button>
                            </div>
                          </div>
                        ) : slotBlock ? (
                          <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                            <div>Reason: {slotBlock.reason || 'Blocked'}</div>
                            {['admin', 'doctor'].includes(staff?.role) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(slotBlock.id)}
                                style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-danger)', textDecoration: 'underline' }}
                              >
                                Unblock Slot
                              </button>
                            )}
                          </div>
                        ) : !isFullDayBlocked ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.8rem', marginTop: '4px', justifyContent: 'center' }}
                            onClick={() => setWalkInModal({ date: day.date, time: slot.time })}
                          >
                            + Walk-In Booking
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Walk-In Booking Modal */}
      {walkInModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Book Walk-In Appointment</h3>
              <span className="modal-close" onClick={() => setWalkInModal(null)}>✕</span>
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#718096' }}>
              Slot: <strong>{walkInModal.date}</strong> at <strong>{walkInModal.time}</strong>
            </div>
            <form onSubmit={handleWalkInSubmit}>
              <div className="form-group">
                <label className="form-label">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Ananya Roy"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  placeholder="+91 98200 12345"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Treatment Category *</label>
                <select
                  className="form-select"
                  value={walkInTreatment}
                  onChange={(e) => setWalkInTreatment(e.target.value)}
                >
                  {TREATMENTS.map((t) => (
                    <option key={t.slug} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Patient Notes (Public)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Interested in hydration peel"
                  value={walkInNotes}
                  onChange={(e) => setWalkInNotes(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Staff / Reception Internal Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. VIP walk-in referred by Dr. Aishwarya"
                  value={walkInStaffNotes}
                  onChange={(e) => setWalkInStaffNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setWalkInModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Booking...' : 'Confirm Walk-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Detail & Status Modal */}
      {bookingDetailModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Booking Details</h3>
              <span className="modal-close" onClick={() => setBookingDetailModal(null)}>✕</span>
            </div>
            <div style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Patient:</span>
                <strong>{bookingDetailModal.contacts?.full_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Phone:</span>
                <span>{bookingDetailModal.contacts?.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Treatment:</span>
                <span>{bookingDetailModal.treatment}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Date & Time:</span>
                <span>{bookingDetailModal.slot_date} at {bookingDetailModal.slot_time}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Source:</span>
                <code>{bookingDetailModal.source}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#718096' }}>Current Status:</span>
                <span className={`status-pill ${bookingDetailModal.status}`}>{bookingDetailModal.status}</span>
              </div>
            </div>

            {/* Pending Confirmation Callout */}
            {bookingDetailModal.status === 'pending' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', padding: '0.85rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, color: '#92400E', fontSize: '0.85rem', marginBottom: '4px' }}>
                  ⚠️ Pending Reception Confirmation
                </div>
                <div style={{ fontSize: '0.8rem', color: '#78350F', marginBottom: '8px' }}>
                  This booking is awaiting telephone or WhatsApp verification with the patient.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a
                    href={`https://wa.me/${(bookingDetailModal.contacts?.phone || '').replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: '#25D366', color: '#FFFFFF', borderColor: '#25D366' }}
                  >
                    💬 WhatsApp Patient
                  </a>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleUpdateStatus(bookingDetailModal.id, 'confirmed')}
                    disabled={actionLoading}
                  >
                    ✓ Confirm Booking
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    onClick={() => handleCancelWithReason(bookingDetailModal.id)}
                    disabled={actionLoading}
                  >
                    ✕ Cancel with Reason
                  </button>
                </div>
              </div>
            )}

            {/* Quick Status Buttons */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Update Status:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['confirmed', 'completed', 'no_show', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      textTransform: 'capitalize',
                      borderColor: bookingDetailModal.status === st ? 'var(--color-forest)' : 'var(--color-border)',
                      fontWeight: bookingDetailModal.status === st ? 700 : 500
                    }}
                    onClick={() => st === 'cancelled' ? handleCancelWithReason(bookingDetailModal.id) : handleUpdateStatus(bookingDetailModal.id, st)}
                    disabled={actionLoading}
                  >
                    Mark {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Notes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Staff Internal Notes:</label>
              <textarea
                className="form-textarea"
                rows={3}
                defaultValue={bookingDetailModal.staff_notes || ''}
                id="staff-notes-input"
                placeholder="Internal notes regarding consultation or arrival..."
              />
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '6px', fontSize: '0.8rem' }}
                onClick={() => {
                  const val = document.getElementById('staff-notes-input')?.value
                  handleSaveStaffNotes(bookingDetailModal.id, val)
                }}
              >
                Save Notes
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: 'var(--color-forest)', borderColor: 'var(--color-forest)' }}
                onClick={() => {
                  setRescheduleModal({
                    bookingId: bookingDetailModal.id,
                    currentDate: bookingDetailModal.slot_date,
                    currentTime: bookingDetailModal.slot_time
                  })
                  setReschedDate(bookingDetailModal.slot_date)
                  setReschedTime(bookingDetailModal.slot_time)
                }}
              >
                🔄 Reschedule Slot
              </button>
              <button type="button" className="btn-secondary" onClick={() => setBookingDetailModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Reschedule Appointment</h3>
              <span className="modal-close" onClick={() => setRescheduleModal(null)}>✕</span>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div className="form-group">
                <label className="form-label">New Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Time (HH:MM)</label>
                <select
                  required
                  className="form-select"
                  value={reschedTime}
                  onChange={(e) => setReschedTime(e.target.value)}
                >
                  <option value="">Select Time...</option>
                  {['09:00', '10:00', '11:30', '13:00', '14:30', '16:00'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setRescheduleModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Slot / Day Modal */}
      {blockModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Block Slot or Day</h3>
              <span className="modal-close" onClick={() => setBlockModal(false)}>✕</span>
            </div>

            {conflictPrompt ? (
              <div>
                <div className="warning-box">
                  ⚠️ <strong>Conflict Warning:</strong> {conflictPrompt.message}
                  <ul style={{ marginTop: '8px', paddingLeft: '1.25rem' }}>
                    {conflictPrompt.conflicts?.map((c) => (
                      <li key={c.id}>
                        {c.slot_time} - {c.contacts?.full_name} ({c.contacts?.phone})
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setConflictPrompt(null)}>
                    Go Back
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleBlockSubmit(true)}
                    disabled={actionLoading}
                  >
                    Confirm Override & Block
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Date to Block *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot (Leave empty to block whole day)</label>
                  <select
                    className="form-select"
                    value={blockTime}
                    onChange={(e) => setBlockTime(e.target.value)}
                  >
                    <option value="">Whole Day (All Slots)</option>
                    {['09:00', '10:00', '11:30', '13:00', '14:30', '16:00'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason for Block</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Doctor Surgery / Conference / Clinic Maintenance"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setBlockModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={() => handleBlockSubmit(false)} disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Apply Block'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
