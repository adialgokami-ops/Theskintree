import React, { useState } from 'react'

const TREATMENTS = {
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
  }
  ,
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

export default function Treatments(){
  const keys = Object.keys(TREATMENTS)
  const [active, setActive] = useState(keys[0])
  const [modal, setModal] = useState(null)

  return (
    <section id="treatments" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Our Treatments</span>
          <h2>Signature Treatments</h2>
          <p>Precision-crafted aesthetic procedures, each designed around your unique skin story.</p>
        </div>

        <div className="tabs" role="tablist">
          {keys.map(k => (
            <button key={k} className={`tab-btn ${active===k? 'is-active':''}`} data-tab={k} onClick={()=>setActive(k)}>{TREATMENTS[k].title}</button>
          ))}
        </div>

        <div style={{marginTop:24}}>
          {keys.map(k => (
            <div key={k} className="tab-panel" data-panel={k} hidden={active!==k}>
              <div className="pillar-card">
                <div className="pillar-card__title">{TREATMENTS[k].title}</div>
                <p className="pillar-card__text">{TREATMENTS[k].benefit}</p>
                <div style={{marginTop:12}}>
                  <button className="btn btn--primary" data-modal-treatment={k} onClick={() => setModal(k)}>Learn more</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {modal && (
          <div id="treatment-modal" className="modal-backdrop is-open" onClick={(e)=>{ if (e.target === e.currentTarget) setModal(null)}}>
            <div className="modal-content">
              <div className="modal-header">
                <h3 id="modal-title" className="modal-title">{TREATMENTS[modal].title}</h3>
                <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
              </div>
              <div id="modal-body" className="modal-body">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'1.25rem',padding:'1rem',background:'var(--c-cream)',borderRadius:12}}>
                  <div><div style={{fontSize:'10px',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-text-light)',marginBottom:3}}>Duration</div><div style={{fontSize:'.875rem',fontWeight:500,color:'var(--c-text-primary)'}}>{TREATMENTS[modal].duration}</div></div>
                  <div><div style={{fontSize:'10px',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-text-light)',marginBottom:3}}>Downtime</div><div style={{fontSize:'.875rem',fontWeight:500,color:'var(--c-text-primary)'}}>{TREATMENTS[modal].downtime}</div></div>
                </div>
                <h4 style={{fontFamily:'var(--font-body)',fontSize:'.75rem',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-terracotta)',marginBottom:'.5rem'}}>Ideal Candidate</h4>
                <p style={{fontSize:'.9375rem',color:'var(--c-text-muted)',marginBottom:'1.25rem',lineHeight:1.7}}>{TREATMENTS[modal].ideal}</p>
                <h4 style={{fontFamily:'var(--font-body)',fontSize:'.75rem',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-terracotta)',marginBottom:'.5rem'}}>Key Benefit</h4>
                <p style={{fontSize:'.9375rem',color:'var(--c-text-muted)',marginBottom:'1.25rem',lineHeight:1.7}}>{TREATMENTS[modal].benefit}</p>
                <h4 style={{fontFamily:'var(--font-body)',fontSize:'.75rem',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-terracotta)',marginBottom:'.5rem'}}>The Procedure</h4>
                <p style={{fontSize:'.9375rem',color:'var(--c-text-muted)',marginBottom:'1.25rem',lineHeight:1.7}}>{TREATMENTS[modal].procedure}</p>
                <h4 style={{fontFamily:'var(--font-body)',fontSize:'.75rem',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--c-terracotta)',marginBottom:'.5rem'}}>Aftercare</h4>
                <p style={{fontSize:'.9375rem',color:'var(--c-text-muted)',lineHeight:1.7}}>{TREATMENTS[modal].aftercare}</p>
                <div style={{marginTop:'1.5rem',paddingTop:'1.5rem',borderTop:'1px solid var(--c-border-light)'}}>
                  <a href="#booking" className="btn btn--primary" style={{width:'100%',justifyContent:'center'}}>Book This Treatment</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
