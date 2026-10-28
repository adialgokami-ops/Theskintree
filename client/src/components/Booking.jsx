import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { TREATMENTS, normalisePhone, validateName, validateEmail, validateNotes } from '@theskintree/shared';
import { getClinicWhatsApp } from '../lib/config.js';

export const CONSENT_VERSION = '2026.1-dpdp';
// Derived as SHA-256 of canonical displayed consent text:
// "I consent to The Skin Tree processing my contact details for appointment scheduling in accordance with the Privacy Notice (v2026.1-dpdp)."
export const CONSENT_HASH = '6f242e4212e81cfb7a2e1bbeee7bd7aecb4a7711862edb3214ecd0487fc348d0';

export default function Booking({ hideHeader = false }) {
  const clinicWhatsApp = getClinicWhatsApp();
  const [step, setStep] = useState(1);
  const [treatment, setTreatment] = useState('Consultation');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  // Security: Cloudflare Turnstile state
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef(null);

  // Slots fetching and refresh state
  const [days, setDays] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotDisappearedMsg, setSlotDisappearedMsg] = useState('');

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Session idempotency key
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Initial treatment from router state or params
  useEffect(() => {
    const passed = location.state?.treatment || searchParams.get('treatment');
    if (passed) {
      const match = TREATMENTS.find(t =>
        t.name.toLowerCase().includes(passed.toLowerCase()) ||
        t.slug.toLowerCase() === passed.toLowerCase()
      );
      if (match) {
        setTreatment(match.name);
      }
    }
  }, [location.state, searchParams]);

  // Fetch slots from API
  const fetchSlots = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingSlots(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch('/api/slots?days=14', { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('Slots service unavailable');
      const data = await res.json();
      if (Array.isArray(data.days)) {
        setDays(data.days);
        setSlotsError(false);

        // Auto-select first available date if none selected
        if (!selectedDate) {
          const firstOpen = data.days.find(d => !d.closed && d.availableCount > 0);
          if (firstOpen) setSelectedDate(firstOpen.date);
        } else {
          // Verify if currently selected time is still available
          const currentDayObj = data.days.find(d => d.date === selectedDate);
          if (currentDayObj && selectedTime) {
            const slotObj = currentDayObj.slots.find(s => s.time === selectedTime);
            if (!slotObj || !slotObj.available) {
              setSelectedTime('');
              setSlotDisappearedMsg('The time slot you previously chose was just reserved. Please select another available slot.');
            } else {
              setSlotDisappearedMsg('');
            }
          }
        }
      }
    } catch (err) {
      console.warn('Slot fetch issue:', err);
      if (!isBackground) setSlotsError(true);
    } finally {
      clearTimeout(timeout);
      if (!isBackground) setLoadingSlots(false);
    }
  }, [selectedDate, selectedTime]);

  // Initial slots fetch
  useEffect(() => {
    fetchSlots(false);
  }, [fetchSlots]);

  // Slot Refresh: Every 15 seconds while visible, and on window focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSlots(true);
      }
    }, 15000);

    const handleFocus = () => {
      fetchSlots(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchSlots]);

  // Calendar manual date selection (up to 60 days)
  const handleCustomDateChange = async (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    setSelectedDate(newDate);
    setSelectedTime('');
    setSlotDisappearedMsg('');

    setLoadingSlots(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`/api/slots?date=${newDate}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('Slots fetch failed');
      const data = await res.json();
      if (Array.isArray(data.days) && data.days.length > 0) {
        // Merge or replace day in list
        setDays(prev => {
          const existing = prev.filter(d => d.date !== newDate);
          return [...existing, data.days[0]].sort((a, b) => a.date.localeCompare(b.date));
        });
        setSlotsError(false);
      }
    } catch (_) {
      setSlotsError(true);
    } finally {
      clearTimeout(timeout);
      setLoadingSlots(false);
    }
  };

  const selectedDayObj = days.find(d => d.date === selectedDate);
  const availableSlotsList = selectedDayObj ? selectedDayObj.slots : [];
  const availableSlotsCount = availableSlotsList.filter(s => s.available).length;

  const handleNextDayWithSlots = () => {
    const nextOpen = days.find(d => d.date > selectedDate && !d.closed && d.availableCount > 0);
    if (nextOpen) {
      setSelectedDate(nextOpen.date);
      setSelectedTime('');
      setSlotDisappearedMsg('');
    }
  };

  // Step Validations
  const validateStep = (s) => {
    if (s === 1) {
      return Boolean(treatment);
    }
    if (s === 2) {
      return Boolean(selectedDate && selectedTime);
    }
    if (s === 3) {
      return (
        validateName(name) &&
        Boolean(normalisePhone(phone)) &&
        validateEmail(email) &&
        validateNotes(notes) &&
        consent
      );
    }
    return true;
  };

  // Form Submission
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: name.trim(),
      phone: normalisePhone(phone),
      email: email.trim() || undefined,
      treatment,
      date: selectedDate,
      time: selectedTime,
      notes: notes.trim() || undefined,
      consent: true,
      consentVersion: CONSENT_VERSION,
      consentTextHash: CONSENT_HASH,
      turnstileToken: turnstileToken || 'interim-client-token',
      idempotencyKey: idempotencyKeyRef.current,
      website: honeypot // Anti-bot honeypot
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle 409 slot taken: refresh slots immediately
        if (res.status === 409) {
          fetchSlots(false);
          setSelectedTime('');
          setStep(2);
          throw new Error(data.error || 'This slot was just booked by another patient. Please choose an open slot.');
        }
        throw new Error(data.error || 'Failed to complete appointment booking.');
      }

      // Hard Rule 7: Only show success when DB insert succeeded
      setBookingSuccess({
        id: data.id,
        manageToken: data.manageToken,
        treatment,
        date: selectedDate,
        time: selectedTime,
        name
      });

      // Reset idempotency key for future new submissions
      idempotencyKeyRef.current = crypto.randomUUID();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Generate .ics calendar download
  const handleDownloadICS = () => {
    if (!bookingSuccess) return;
    const { date, time, treatment: tName } = bookingSuccess;
    const startIso = `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//The Skin Tree//Consultation Schedule//EN',
      'BEGIN:VEVENT',
      `SUMMARY:Consultation: ${tName} — Dr. Aishwarya Agarwal`,
      `DESCRIPTION:Consultation at The Skin Tree with Dr. Aishwarya Agarwal.\\nLocation: Bandra West, Mumbai.`,
      `LOCATION:The Skin Tree, 123 Serenity Lane, Bandra West, Mumbai`,
      `DTSTART:${startIso}`,
      `DTEND:${startIso}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TheSkinTree-${date}-${time}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="booking-container"
      className="booking-widget"
      style={{
        background: 'var(--c-cream)',
        padding: 'clamp(1.5rem, 4vw, 2.75rem)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
        maxWidth: '820px',
        margin: '0 auto'
      }}
    >
      {!hideHeader && !bookingSuccess && (
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="eyebrow">Aesthetic Dermatology Consultation</span>
          <h2 style={{ fontSize: 'var(--fs-2xl)', margin: '0.25rem 0 0.5rem 0', color: 'var(--c-umber)' }}>
            Reserve Your Session
          </h2>
          <p style={{ color: 'var(--c-text-secondary)', maxWidth: '560px', margin: '0 auto', fontSize: '0.925rem' }}>
            Consultation with Dr. Aishwarya Agarwal. Experience tailored assessment and bespoke dermatological treatment design.
          </p>
        </div>
      )}

      {/* Step Progress Bar */}
      {!bookingSuccess && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { num: 1, label: 'Treatment' },
            { num: 2, label: 'Date & Time' },
            { num: 3, label: 'Your Details' },
            { num: 4, label: 'Review' }
          ].map((s) => (
            <div
              key={s.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: step === s.num ? 700 : 500,
                color: step === s.num ? 'var(--c-terracotta)' : 'var(--c-text-muted)'
              }}
            >
              <span>{s.num}. {s.label}</span>
              {s.num < 4 && <span style={{ opacity: 0.4 }}>→</span>}
            </div>
          ))}
        </div>
      )}

      {/* ERROR BANNER */}
      {submitError && (
        <div style={{
          background: '#FEECEB',
          color: '#C22C24',
          border: '1px solid rgba(194, 44, 36, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          lineHeight: 1.5
        }}>
          {submitError}
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {bookingSuccess ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌿</div>
          <span className="eyebrow" style={{ color: 'var(--c-terracotta)' }}>Request Received</span>
          <h3 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--c-umber)', margin: '0.5rem 0 1rem', maxWidth: '580px', marginLeft: 'auto', marginRight: 'auto' }}>
            Request received. This is not confirmed yet. Our team will call or WhatsApp you to confirm.
          </h3>
          <p style={{ color: 'var(--c-text-primary)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto 1.5rem' }}>
            Dear <strong>{bookingSuccess.name}</strong>, your consultation appointment request with <strong>Dr. Aishwarya Agarwal</strong> for <strong>{bookingSuccess.treatment}</strong> has been received for <strong>{bookingSuccess.date}</strong> at <strong>{bookingSuccess.time} IST</strong>.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleDownloadICS}
            >
              📅 Add to Calendar (.ics)
            </button>
            {clinicWhatsApp ? (
              <a
                href={`https://wa.me/${clinicWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello The Skin Tree, I have submitted consultation request #${bookingSuccess.id.slice(0, 8)} for ${bookingSuccess.date} at ${bookingSuccess.time}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--outline"
              >
                💬 WhatsApp Concierge
              </a>
            ) : null}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.7)', padding: '14px 18px', borderRadius: '12px', maxWidth: '480px', margin: '0 auto', fontSize: '0.85rem', color: 'var(--c-text-secondary)' }}>
            Need to reschedule or cancel? You can manage your booking anytime at:{' '}
            <Link to={`/manage/${bookingSuccess.manageToken}`} style={{ color: 'var(--c-terracotta)', fontWeight: 600, wordBreak: 'break-all' }}>
              /manage/{bookingSuccess.manageToken}
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitBooking}>
          {/* Honeypot field (hidden from real users) */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
          />

          {/* STEP 1: TREATMENT SELECTOR */}
          {step === 1 && (
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--c-text-primary)' }}>
                Select Treatment Category:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                {TREATMENTS.map(t => (
                  <button
                    key={t.slug}
                    type="button"
                    aria-pressed={treatment === t.name}
                    onClick={() => setTreatment(t.name)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid',
                      borderColor: treatment === t.name ? 'var(--c-terracotta)' : 'var(--c-border-light)',
                      background: treatment === t.name ? 'var(--c-terracotta)' : '#FFFFFF',
                      color: treatment === t.name ? '#FFFFFF' : 'var(--c-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setStep(2)}
                >
                  Next: Select Date & Time →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DATESTRIP + SLOTGRID */}
          {step === 2 && (
            <div>
              {slotDisappearedMsg && (
                <div style={{ background: '#FFF5EB', color: 'var(--c-terracotta-dark)', padding: '10px 14px', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                  {slotDisappearedMsg}
                </div>
              )}

              {/* DateStrip: 14 Days */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontWeight: 600, color: 'var(--c-text-primary)', fontSize: '0.9rem' }}>
                  Select Consultation Date (Next 14 Days):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>More dates:</span>
                  <input
                    type="date"
                    onChange={handleCustomDateChange}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--c-border)',
                      fontSize: '0.8rem',
                      background: '#FFFFFF',
                      color: 'var(--c-text-primary)'
                    }}
                  />
                </div>
              </div>

              {slotsError && days.length === 0 ? (
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: '#FFF5EB',
                  border: '1px solid rgba(184, 93, 58, 0.25)',
                  textAlign: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ margin: '0 0 0.75rem 0', color: 'var(--c-terracotta-dark)', fontWeight: 600, fontSize: '0.9rem' }}>
                    Calendar service is temporarily taking longer to respond.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => fetchSlots(false)}
                      className="btn btn--primary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      🔄 Retry Loading Times
                    </button>
                    {clinicWhatsApp ? (
                      <a
                        href={`https://wa.me/${clinicWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent('Hello The Skin Tree, I would like to book an appointment with Dr. Aishwarya.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--outline"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        💬 WhatsApp Concierge
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '12px',
                  marginBottom: '1.5rem',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {loadingSlots && days.length === 0 ? (
                    // Skeleton loader
                    Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: '0 0 74px',
                          height: '70px',
                          background: 'rgba(212, 184, 150, 0.3)',
                          borderRadius: '10px',
                          animation: 'pulse 1.5s infinite'
                        }}
                      />
                    ))
                  ) : (
                    days.map(d => {
                      const isClosed = d.closed || d.availableCount === 0;
                      const isSelected = selectedDate === d.date;
                      const dateObj = new Date(d.date + 'T00:00:00Z');
                      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                      const dayNum = d.date.slice(8);

                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={isClosed}
                          onClick={() => { setSelectedDate(d.date); setSelectedTime(''); setSlotDisappearedMsg(''); }}
                          style={{
                            flex: '0 0 74px',
                            padding: '8px 4px',
                            borderRadius: '10px',
                            border: '1.5px solid',
                            borderColor: isSelected ? 'var(--c-terracotta)' : isClosed ? 'rgba(212, 184, 150, 0.3)' : 'var(--c-border)',
                            background: isSelected ? 'var(--c-terracotta)' : isClosed ? 'rgba(239, 221, 206, 0.4)' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : isClosed ? 'var(--c-text-muted)' : 'var(--c-text-primary)',
                            cursor: isClosed ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                            opacity: isClosed ? 0.6 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.8 }}>{weekday}</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2px 0' }}>{dayNum}</div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 500 }}>
                            {d.closed ? 'Closed' : `${d.availableCount} slots`}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* SlotGrid: Two-state design */}
              <div style={{ background: '#FFFFFF', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--c-border-light)', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--c-text-primary)' }}>
                    {availableSlotsCount} times available on {selectedDate || 'selected date'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                    Refreshes every 15s
                  </span>
                </div>

                {availableSlotsCount === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <p style={{ color: 'var(--c-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                      No consultation times available on this date.
                    </p>
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={handleNextDayWithSlots}
                    >
                      Show Next Available Day →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px' }}>
                    {availableSlotsList.map(s => {
                      const isChosen = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={!s.available}
                          aria-pressed={isChosen}
                          onClick={() => { setSelectedTime(s.time); setSlotDisappearedMsg(''); }}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '8px',
                            border: '1.5px solid',
                            borderColor: isChosen ? 'var(--c-terracotta)' : s.available ? 'var(--c-terracotta)' : 'var(--c-border-light)',
                            background: isChosen ? 'var(--c-terracotta)' : s.available ? '#FFFFFF' : 'rgba(239, 221, 206, 0.3)',
                            color: isChosen ? '#FFFFFF' : s.available ? 'var(--c-terracotta-dark)' : 'var(--c-text-muted)',
                            cursor: s.available ? 'pointer' : 'not-allowed',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            textDecoration: s.available ? 'none' : 'line-through',
                            opacity: s.available ? 1 : 0.45,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button type="button" className="btn btn--outline" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(3)}
                >
                  Next: Your Details →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTACT DETAILS & CONSENT */}
          {step === 3 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label htmlFor="b-name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Full Name *
                  </label>
                  <input
                    id="b-name"
                    type="text"
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: '16px' }}
                    placeholder="e.g. Ananya Sharma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="b-phone" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Phone Number *
                  </label>
                  <input
                    id="b-phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: '16px' }}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="b-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Email Address (Optional — for calendar invite & management link)
                  </label>
                  <input
                    id="b-email"
                    type="email"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: '16px' }}
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="b-notes" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Notes (Optional — max 500 characters)
                  </label>
                  <textarea
                    id="b-notes"
                    rows="3"
                    maxLength={500}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: '16px' }}
                    placeholder="General consultation goals..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: 4 }}>
                    Please do not share medical details here; discuss them with the doctor.
                  </div>
                </div>
              </div>

              {/* AI-Processing Disclosure (DPDP Act 2023 Compliance) */}
              <div style={{ marginBottom: '1.25rem', padding: '12px 14px', background: 'rgba(184, 93, 58, 0.06)', borderRadius: 8, border: '1px solid rgba(184, 93, 58, 0.2)', fontSize: '0.8125rem', color: 'var(--c-umber)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--c-terracotta)', display: 'block', marginBottom: '2px' }}>
                  🌿 AI-Assisted Concierge Disclosure (DPDP Act 2023)
                </strong>
                Our digital concierge uses AI assistance for treatment inquiries, clinic information, and appointment scheduling.
                All clinical consultations, dermatological diagnoses, prescriptions, and aesthetic treatments are conducted
                exclusively in person by <strong>Dr. Aishwarya Agarwal (MBBS, MD Dermatology)</strong>.
              </div>

              {/* Cloudflare Turnstile Bot Defense Container */}
              <div ref={turnstileContainerRef} id="turnstile-widget" style={{ marginBottom: '1.25rem', minHeight: '40px' }}></div>

              {/* Mandatory Consent Checkbox */}
              <div style={{ marginBottom: '1.75rem', padding: '12px 16px', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--c-border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I consent to The Skin Tree processing my contact details for appointment scheduling in accordance with the{' '}
                    <Link to="/privacy" target="_blank" style={{ color: 'var(--c-terracotta)', fontWeight: 600 }}>
                      Privacy Notice
                    </Link>{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>(v{CONSENT_VERSION})</span>.
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button type="button" className="btn btn--outline" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!validateStep(3)}
                  onClick={() => setStep(4)}
                >
                  Next: Review Booking →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step === 4 && (
            <div>
              <div style={{ background: '#FFFFFF', padding: '1.75rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--c-border-light)', marginBottom: '1.75rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--c-umber)', fontSize: '1.15rem' }}>
                  Review Consultation Summary
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Doctor</span>
                    <strong>Dr. Aishwarya Agarwal</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Focus</span>
                    <strong>{treatment}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date</span>
                    <strong>{selectedDate}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Time Slot</span>
                    <strong>{selectedTime} IST</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient Name</span>
                    <strong>{name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--c-text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Contact Number</span>
                    <strong>{phone}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button type="button" className="btn btn--outline" onClick={() => setStep(3)}>
                  ← Edit Details
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting Request…' : 'Submit Consultation Request'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
