import React, { useEffect, useState } from 'react'
import { trackEvent } from '../lib/analytics'

const TIMEST = ['09:00','10:00','11:30','13:00','14:30','16:00']
const TREATMENTS = [
  'Botox / Toxin',
  'Dermal Fillers',
  'Fractional Laser',
  'HydraFacial',
  'Chemical Peels',
  'Acne Treatment',
  'Consultation'
]

function isEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }
function isPhone(v){ return /^\+?[0-9\s\-]{7,15}$/.test(v) }

export default function Booking(){
  const [step, setStep] = useState(1)
  const [selections, setSelections] = useState({treatment:'', date:'', time:'', name:'', email:'', phone:'', note:''})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    const d = new Date(); d.setDate(d.getDate()+1);
    const el = document.getElementById('booking-date'); if (el) el.min = d.toISOString().split('T')[0];
  },[])

  const validateStep = (s) => {
    const err = {}
    if (s===1){ if (!selections.treatment) err.treatment = 'Please select a treatment' }
    if (s===2){ if (!selections.date) err.date = 'Please choose a date'; if (!selections.time) err.time = 'Please choose a time' }
    if (s===3){ if (!selections.name) err.name='Please enter full name'; if (!isEmail(selections.email)) err.email='Enter a valid email'; if (!isPhone(selections.phone)) err.phone='Enter a valid phone' }
    setErrors(err); return Object.keys(err).length===0
  }

  const next = (n)=>{
    if (!validateStep(step)) return
    setStep(n)
    trackEvent('booking_step', { step: n })
  }

  const submit = async (e)=>{
    e.preventDefault();
    if (!validateStep(3)) return
    setLoading(true)
    trackEvent('booking_submitted', { treatment: selections.treatment })
    const webhook = import.meta.env.VITE_BOOKING_WEBHOOK || ''
    try{
      if (webhook){
        await fetch(webhook, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(selections) })
      } else {
        // fallback: log to console (developer can configure webhook)
        console.info('Booking payload', selections)
      }
      setSubmitted(true)
    }catch(err){
      console.error(err); alert('Failed to submit — please try again or call us.')
    }finally{ setLoading(false) }
  }

  return (
    <section id="booking" className="section bg-cream">
      <div className="container">
        <div className="section-header"><span className="eyebrow">Book</span><h2>Book a Private Consultation</h2></div>
        {!submitted ? (
          <form id="booking-form" onSubmit={submit} aria-live="polite">
            <div className="booking-step" data-step="1" hidden={step!==1}>
              <div className="grid-3">
                {TREATMENTS.map(t => (
                  <button type="button" key={t} aria-pressed={selections.treatment===t} className={`booking-treatment-btn btn ${selections.treatment===t? 'is-selected':''}`} data-treatment={t} onClick={()=>setSelections(s=>({...s,treatment:t}))}>{t}</button>
                ))}
              </div>
              {errors.treatment && <div className="form-error">{errors.treatment}</div>}
              <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'center'}}>
                <button type="button" data-booking-next="2" className="btn btn--primary" onClick={()=>next(2)}>Next</button>
              </div>
            </div>

            <div className="booking-step" data-step="2" hidden={step!==2}>
              <div className="form-group">
                <label className="form-label" htmlFor="booking-date">Date</label>
                <input id="booking-date" className="form-input" type="date" value={selections.date} onChange={e=>setSelections(s=>({...s,date:e.target.value}))} aria-required="true" />
                {errors.date && <div className="form-error">{errors.date}</div>}
              </div>
              <div className="slot-grid">
                {TIMEST.map(t=> <button key={t} type="button" className={`slot-btn ${selections.time===t? 'is-selected':''}`} onClick={() => setSelections(s=>({...s,time:t}))}>{t}</button>)}
              </div>
              {errors.time && <div className="form-error">{errors.time}</div>}
              <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'center'}}>
                <button type="button" data-booking-back="1" className="btn btn--outline" onClick={()=>setStep(1)}>Back</button>
                <button type="button" data-booking-next="3" className="btn btn--primary" onClick={()=>next(3)}>Next</button>
              </div>
            </div>

            <div className="booking-step" data-step="3" hidden={step!==3}>
              <div className="form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                <div>
                  <label className="form-label" htmlFor="booking-name">Full name</label>
                  <input id="booking-name" className="form-input" value={selections.name} onChange={e=>setSelections(s=>({...s,name:e.target.value}))} aria-required="true" />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div>
                  <label className="form-label" htmlFor="booking-phone">Phone</label>
                  <input id="booking-phone" className="form-input" value={selections.phone} onChange={e=>setSelections(s=>({...s,phone:e.target.value}))} aria-required="true" />
                  {errors.phone && <div className="form-error">{errors.phone}</div>}
                </div>
                <div>
                  <label className="form-label" htmlFor="booking-email">Email</label>
                  <input id="booking-email" className="form-input" value={selections.email} onChange={e=>setSelections(s=>({...s,email:e.target.value}))} aria-required="true" />
                  {errors.email && <div className="form-error">{errors.email}</div>}
                </div>
                <div>
                  <label className="form-label" htmlFor="booking-note">Notes (optional)</label>
                  <input id="booking-note" className="form-input" value={selections.note} onChange={e=>setSelections(s=>({...s,note:e.target.value}))} />
                </div>
              </div>
              <div style={{textAlign:'center',marginTop:16}}>
                <h3>Confirm</h3>
                <p><strong>Treatment:</strong> {selections.treatment || '-'}</p>
                <p><strong>Date:</strong> {selections.date || '-'}</p>
                <p><strong>Time:</strong> {selections.time || '-'}</p>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:12}}>
                <button type="button" className="btn btn--outline" onClick={()=>setStep(2)}>Back</button>
                <button type="submit" className="btn btn--primary" disabled={loading}>{loading? 'Sending…' : 'Request'}</button>
              </div>
            </div>
          </form>
        ) : (
          <div id="booking-success">
            <h3>Thanks — your request was received.</h3>
            <p>We will contact you shortly to confirm the appointment.</p>
          </div>
        )}
      </div>
    </section>
  )
}
