import React, { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

function BeforeAfter({ before, after, alt = 'Before/After', preview = false }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const slider = containerRef.current
    if (!slider) return
    const afterEl = slider.querySelector('.ba-after')
    const divider = slider.querySelector('.ba-divider')
    const handle = slider.querySelector('.ba-handle')
    let dragging = false

    const setPos = (x) => {
      const r = slider.getBoundingClientRect()
      const pct = Math.max(5, Math.min(95, ((x - r.left) / r.width) * 100))
      afterEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`
      if (divider) divider.style.left = pct + '%'
      if (handle) handle.style.left = pct + '%'
    }

    const onDown = e => { dragging = true; setPos((e.touches ? e.touches[0].clientX : e.clientX)) }
    const onMove = e => { if (dragging) setPos((e.touches ? e.touches[0].clientX : e.clientX)) }
    const onUp = () => { dragging = false }

    slider.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    slider.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)

    return () => {
      slider.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      slider.removeEventListener('touchstart', onDown)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  return (
    <div className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Clinical Transformations</span>
          <h2>Real Results</h2>
          <p>Authentic, privacy-compliant before & after results from consenting patients.</p>
        </div>
        <div className="before-after-row">
          <div>
            <div className="before-after-slider" ref={containerRef} style={{aspectRatio: '16/9'}}>
              <img className="ba-img ba-before" src={before} alt={alt} />
              <img className="ba-img ba-after" src={after} alt={alt} />
              <div className="ba-divider"></div>
              <div className="ba-handle" aria-hidden="true"></div>
              <div className="ba-label ba-label--before">Before</div>
              <div className="ba-label ba-label--after">After</div>
            </div>
            <p style={{marginTop: '1rem', color: 'var(--c-text-muted)'}}><em>Drag the slider to compare — Skin Rejuvenation Protocol</em></p>
            <p style={{fontSize: '.95rem', color: 'var(--c-text-muted)', marginTop: '.75rem'}}>
              Why results feel different here: structured, physician-led care; 15+ years experience; 98% patient satisfaction; 5,000+ patients transformed. Individual results may vary. All photos published with full patient consent.
            </p>
          </div>
          <div style={{background: 'var(--c-cream)', padding: '1.5rem', borderRadius: 16}}>
            <h4 style={{marginBottom: 12}}>The Clinical Experience</h4>
            <ul style={{lineHeight: 1.8, color: 'var(--c-text-primary)'}}>
              <li><strong>1:1 Consultation</strong> — Tailored treatment mapping.</li>
              <li><strong>Physician-Led Care</strong> — Board-certified doctor oversight.</li>
              <li><strong>Evidence-Based Protocols</strong> — Proven, internationally accredited methods.</li>
            </ul>
            <p style={{marginTop: 16, fontSize: '.875rem', color: 'var(--c-text-muted)'}}>
              All images published with patient consent.
            </p>
            {!preview && (
              <div style={{marginTop: 20}}>
                <Link to="/contact" className="btn btn--primary" style={{width: '100%', justifyContent: 'center'}}>
                  Book Your Consultation →
                </Link>
              </div>
            )}
          </div>
        </div>

        {preview && (
          <div style={{textAlign: 'center', marginTop: '2.5rem'}}>
            <Link to="/gallery" className="btn btn--outline">View All Before & After Transformations →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Transformations({ preview = false }) {
  return (
    <BeforeAfter
      before={'/assets/images/treatment.png'}
      after={'/assets/images/clinic.png'}
      alt={'Treatment before after'}
      preview={preview}
    />
  )
}
