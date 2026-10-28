import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function ManageBooking() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [availableDays, setAvailableDays] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Cancel state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/manage?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to find appointment.');
      }
      setBooking(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBooking();
    }
  }, [token, fetchBooking]);

  // Fetch slots for rescheduling
  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setRescheduleError(null);
    try {
      const res = await fetch('/api/slots?days=14');
      const data = await res.json();
      if (res.ok && Array.isArray(data.days)) {
        setAvailableDays(data.days);
        const firstOpenDay = data.days.find(d => !d.closed && d.availableCount > 0);
        if (firstOpenDay) {
          setRescheduleDate(firstOpenDay.date);
        }
      }
    } catch (_) {
      setRescheduleError('Unable to load available slots. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleStartReschedule = () => {
    setIsRescheduling(true);
    loadSlots();
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select both a date and an available time slot.');
      return;
    }
    setSubmittingReschedule(true);
    setRescheduleError(null);

    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'reschedule',
          date: rescheduleDate,
          time: rescheduleTime
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule.');
      }

      setIsRescheduling(false);
      await fetchBooking();
    } catch (err) {
      setRescheduleError(err.message);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'cancel'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel appointment.');
      }

      setShowCancelModal(false);
      await fetchBooking();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const selectedDayObj = availableDays.find(d => d.date === rescheduleDate);

  return (
    <div className="page-manage-booking">
      <PageHeader
        eyebrow="Appointment Management"
        title="Your Consultation Details"
        subtitle="Review, reschedule, or cancel your upcoming consultation with Dr. Aishwarya Agarwal."
      />

      <section className="section bg-off-white" style={{ minHeight: '60vh', padding: '3.5rem 0' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '1.25rem', color: 'var(--c-text-muted)' }}>Loading appointment details...</div>
            </div>
          ) : error ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2CEBC',
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: 'var(--c-umber)', marginBottom: '1rem' }}>Appointment Not Found</h3>
              <p style={{ color: 'var(--c-text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                {error || 'The link may be expired or invalid. Please check your confirmation message or contact the clinic concierge.'}
              </p>
              <Link to="/contact" className="btn btn--primary">Book New Consultation →</Link>
            </div>
          ) : (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #D4B896',
              borderRadius: 'var(--radius-xl)',
              padding: 'clamp(1.5rem, 4vw, 2.5rem)',
              boxShadow: 'var(--shadow-md)'
            }}>
              {/* Header card */}
              <div style={{ borderBottom: '1px solid var(--c-border-light)', paddingBottom: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-terracotta)', fontWeight: 600 }}>
                    Appointment Status
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: 'var(--c-umber)' }}>
                    Hello, {booking.firstName}
                  </h3>
                </div>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  background: booking.status === 'confirmed' ? '#E7F7ED' : booking.status === 'cancelled' ? '#FEECEB' : '#FFF5EB',
                  color: booking.status === 'confirmed' ? '#1B7F45' : booking.status === 'cancelled' ? '#C22C24' : '#B25936'
                }}>
                  {booking.status}
                </span>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                    Dermatologist
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>Dr. Aishwarya Agarwal</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                    Consultation Focus
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>{booking.treatment}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                    Date
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>{booking.date}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontWeight: 600, marginBottom: 4 }}>
                    Time Slot
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--c-text-primary)' }}>{booking.time} IST</div>
                </div>
              </div>

              {/* Action Buttons */}
              {booking.status !== 'cancelled' && booking.status !== 'completed' && !isRescheduling && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--c-border-light)', paddingTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleStartReschedule}
                  >
                    Reschedule Consultation
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Appointment
                  </button>
                </div>
              )}

              {/* Reschedule Flow */}
              {isRescheduling && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--c-border-light)', paddingTop: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--c-umber)' }}>Select New Date & Time</h4>

                  {rescheduleError && (
                    <div style={{ background: '#FEECEB', color: '#C22C24', padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                      {rescheduleError}
                    </div>
                  )}

                  {loadingSlots ? (
                    <div>Loading available slots...</div>
                  ) : (
                    <>
                      {/* Date selection row */}
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>
                        Available Dates
                      </label>
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '1.25rem' }}>
                        {availableDays.map(d => {
                          const isClosed = d.closed || d.availableCount === 0;
                          return (
                            <button
                              key={d.date}
                              type="button"
                              disabled={isClosed}
                              onClick={() => { setRescheduleDate(d.date); setRescheduleTime(''); }}
                              style={{
                                flex: '0 0 auto',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                border: '1px solid',
                                borderColor: rescheduleDate === d.date ? 'var(--c-terracotta)' : '#D4B896',
                                background: rescheduleDate === d.date ? 'var(--c-terracotta)' : isClosed ? '#F5ECE0' : '#FFFFFF',
                                color: rescheduleDate === d.date ? '#FFFFFF' : isClosed ? '#B89A78' : 'var(--c-text-primary)',
                                cursor: isClosed ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>{d.date.slice(5)}</div>
                              <div style={{ fontSize: '0.7rem' }}>{d.closed ? 'Closed' : `${d.availableCount} slots`}</div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Time slot selection */}
                      {selectedDayObj && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>
                            Available Slots on {rescheduleDate}
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
                            {selectedDayObj.slots.map(s => (
                              <button
                                key={s.time}
                                type="button"
                                disabled={!s.available}
                                onClick={() => setRescheduleTime(s.time)}
                                style={{
                                  padding: '8px',
                                  borderRadius: '8px',
                                  border: '1.5px solid',
                                  borderColor: rescheduleTime === s.time ? 'var(--c-terracotta)' : s.available ? '#D4B896' : '#E2CEBC',
                                  background: rescheduleTime === s.time ? 'var(--c-terracotta)' : s.available ? '#FFFFFF' : '#F5ECE0',
                                  color: rescheduleTime === s.time ? '#FFFFFF' : s.available ? 'var(--c-text-primary)' : '#B89A78',
                                  cursor: s.available ? 'pointer' : 'not-allowed',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  textDecoration: s.available ? 'none' : 'line-through'
                                }}
                              >
                                {s.time}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={submittingReschedule || !rescheduleDate || !rescheduleTime}
                          onClick={handleConfirmReschedule}
                        >
                          {submittingReschedule ? 'Rescheduling…' : 'Confirm New Slot'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => setIsRescheduling(false)}
                        >
                          Back
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Cancel Confirmation Modal */}
              {showCancelModal && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(61, 30, 22, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '20px'
                }}>
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-lg)',
                    maxWidth: '460px',
                    width: '100%',
                    padding: '2rem',
                    boxShadow: 'var(--shadow-xl)'
                  }}>
                    <h3 style={{ color: 'var(--c-umber)', margin: '0 0 12px 0' }}>Cancel Appointment?</h3>
                    <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                      Are you sure you wish to cancel your consultation for <strong>{booking.date} at {booking.time}</strong>? This slot will immediately be released.
                    </p>

                    {cancelError && (
                      <div style={{ background: '#FEECEB', color: '#C22C24', padding: '10px 14px', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                        {cancelError}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn--outline"
                        disabled={cancelling}
                        onClick={() => setShowCancelModal(false)}
                      >
                        Keep Appointment
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ background: '#C22C24', borderColor: '#C22C24' }}
                        disabled={cancelling}
                        onClick={handleConfirmCancel}
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
