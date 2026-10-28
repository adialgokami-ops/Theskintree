import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const TREATMENTS = {
  botox: {
    title: 'Botulinum Toxin (Botox®)',
    duration: '20–30 minutes', downtime: 'None',
    ideal: 'Adults 25+ with dynamic wrinkles (frown lines, crow\'s feet, forehead lines)',
    benefit: 'Smoothes expression lines for 3–6 months with natural-looking results',
    procedure: 'Precision micro-injections of purified botulinum toxin relax targeted facial muscles, visibly softening wrinkles. Our doctors use advanced anatomical mapping for symmetry and subtlety.',
    aftercare: 'Avoid strenuous activity for 24h. No lying flat for 4h post-treatment.'
  },
  fillers: {
    title: 'Dermal Fillers (Hyaluronic Acid)',
    duration: '30–60 minutes', downtime: '1–2 days',
    ideal: 'Patients seeking volume restoration, lip enhancement, or facial contouring',
    benefit: 'Immediate volumising effect lasting 12–18 months',
    procedure: 'Premium HA filler is sculpted into targeted areas using ultra-fine cannulas or needles. Results are immediate and reversible.',
    aftercare: 'Avoid intense heat, exercise, and facial massages for 48h.'
  },
  hydrafacial: {
    title: 'Medical HydraFacial',
    duration: '60 minutes', downtime: 'None',
    ideal: 'All skin types seeking deep cleanse, hydration, and glow',
    benefit: 'Instantly luminous, plump, refined skin — zero downtime',
    procedure: 'Multi-step vortex technology simultaneously cleanses, exfoliates, extracts impurities, and infuses customised serums.',
    aftercare: 'Avoid exfoliants for 72h. Apply SPF daily.'
  },
  laser: {
    title: 'Fractional Laser Resurfacing',
    duration: '45–90 minutes', downtime: '3–7 days',
    ideal: 'Patients with texture concerns, acne scarring, or uneven tone',
    benefit: 'Stimulates deep collagen remodelling for long-term skin renewal',
    procedure: 'Fractional ablative or non-ablative laser creates controlled micro-injuries to encourage collagen remodelling.',
    aftercare: 'Expect transient redness and peeling. Use gentle skincare and SPF.'
  },
  peels: {
    title: 'Chemical Peels',
    duration: '30–45 minutes', downtime: '24–72 hours',
    ideal: 'Dull skin, pigmentation, shallow scarring',
    benefit: 'Resurfaces the skin to reveal smoother, more even tone',
    procedure: 'Professionally-selected acid blends are applied to exfoliate and refresh the skin surface.',
    aftercare: 'Avoid direct sun. Use soothing products as recommended.'
  },
  acne: {
    title: 'Acne & Acne-Scarring Treatments',
    duration: '30–60 minutes', downtime: 'Varies',
    ideal: 'Active acne or residual scarring',
    benefit: 'Targeted protocols to reduce inflammation, clear skin, and improve texture',
    procedure: 'Combination of medical-grade peels, lasers, topical prescriptions and in-clinic treatments personalised to severity.',
    aftercare: 'Follow prescribed skincare and avoid picking or abrasive products.'
  },
  consult: {
    title: 'Consultation',
    duration: '30 minutes', downtime: 'None',
    ideal: 'New patients seeking personalised treatment plans',
    benefit: 'Comprehensive assessment and tailored plan from our expert dermatologist',
    procedure: 'Detailed skin analysis, history, and recommended treatment pathway.',
    aftercare: 'A written treatment plan and product recommendations will be provided.'
  }
}

export default function Treatments({ preview = false }) {
  const allKeys = Object.keys(TREATMENTS)
  const displayKeys = preview ? ['botox', 'fillers', 'hydrafacial'] : allKeys
  const [active, setActive] = useState(displayKeys[0])
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

  const handleBook = (k) => {
    const treatmentTitle = TREATMENTS[k]?.title || k
    setModal(null)
    navigate('/contact', { state: { treatment: treatmentTitle } })
  }

  return (
    <section id="treatments" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">{preview ? 'Featured Treatments' : 'Our Treatments'}</span>
          <h2>{preview ? 'Signature Procedures' : 'All Clinical Protocols'}</h2>
          <p>Precision-crafted aesthetic procedures, each designed around your unique skin story.</p>
        </div>

        <div className="tabs" role="tablist">
          {displayKeys.map(k => (
            <button
              key={k}
              className={`tab-btn ${active === k ? 'is-active' : ''}`}
              data-tab={k}
              onClick={() => setActive(k)}
            >
              {TREATMENTS[k].title}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '2rem' }}>
          {displayKeys.map(k => (
            <div key={k} className="tab-panel" data-panel={k} hidden={active !== k}>
              <div className="pillar-card" style={{ textAlign: 'left', padding: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}>
                <h3 className="pillar-card__title" style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.85rem)', marginBottom: '1rem', color: 'var(--c-umber)' }}>{TREATMENTS[k].title}</h3>
                <p className="pillar-card__text" style={{ fontSize: '1rem', lineHeight: 1.8, marginBottom: '2rem' }}>{TREATMENTS[k].benefit}</p>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <button className="btn btn--outline" style={{ minHeight: '48px', padding: '0.9rem 1.75rem' }} onClick={() => setModal(k)}>Learn more</button>
                  <button className="btn btn--primary" style={{ minHeight: '48px', padding: '0.9rem 1.75rem' }} onClick={() => handleBook(k)}>Book This Treatment</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {preview && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/treatments" className="btn btn--outline" style={{ minHeight: '48px' }}>View All Treatments & Protocols →</Link>
          </div>
        )}

        {modal && (
          <div id="treatment-modal" className="modal-backdrop is-open" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="modal-title" className="modal-title">{TREATMENTS[modal].title}</h3>
                <button className="modal-close" onClick={() => setModal(null)} aria-label="Close dialog">✕</button>
              </div>
              <div id="modal-body" className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem 1.5rem', background: 'var(--c-cream)', borderRadius: 16 }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-text-light)', marginBottom: 4 }}>Duration</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--c-text-primary)' }}>{TREATMENTS[modal].duration}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-text-light)', marginBottom: 4 }}>Downtime</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--c-text-primary)' }}>{TREATMENTS[modal].downtime}</div>
                  </div>
                </div>

                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-terracotta)', marginBottom: '.6rem' }}>Ideal Candidate</h4>
                <p style={{ fontSize: '.95rem', color: 'var(--c-text-muted)', marginBottom: '1.5rem', lineHeight: 1.75 }}>{TREATMENTS[modal].ideal}</p>

                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-terracotta)', marginBottom: '.6rem' }}>Key Benefit</h4>
                <p style={{ fontSize: '.95rem', color: 'var(--c-text-muted)', marginBottom: '1.5rem', lineHeight: 1.75 }}>{TREATMENTS[modal].benefit}</p>

                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-terracotta)', marginBottom: '.6rem' }}>The Procedure</h4>
                <p style={{ fontSize: '.95rem', color: 'var(--c-text-muted)', marginBottom: '1.5rem', lineHeight: 1.75 }}>{TREATMENTS[modal].procedure}</p>

                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.8rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--c-terracotta)', marginBottom: '.6rem' }}>Aftercare</h4>
                <p style={{ fontSize: '.95rem', color: 'var(--c-text-muted)', lineHeight: 1.75 }}>{TREATMENTS[modal].aftercare}</p>

                <div style={{ marginTop: '2rem', paddingTop: '1.75rem', borderTop: '1px solid var(--c-border-light)', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ width: '100%', justifyContent: 'center', minHeight: '52px', fontSize: '1rem' }}
                    onClick={() => handleBook(modal)}
                  >
                    Book Consultation for This Concern →
                  </button>
                  <p style={{ fontSize: '0.82rem', color: 'var(--c-text-muted)', marginTop: '0.75rem', marginBottom: 0, lineHeight: 1.5 }}>
                    Dr. Aishwarya will assess your skin in person and curate your bespoke treatment plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
