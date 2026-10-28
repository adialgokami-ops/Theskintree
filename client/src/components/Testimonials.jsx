import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Testimonials({ preview = false }) {
  const slides = [
    { text: "Five stars simply isn't enough. The clinic is breathtakingly beautiful, the staff impeccably professional, and my results are nothing short of miraculous.", author: 'Riya M.', location: 'Verified Patient · Mumbai' },
    { text: 'Highly recommended — Dr. Aishwarya and her entire team are exceptionally expert, empathetic, and gentle throughout the procedure.', author: 'R. Gupta', location: 'Verified Patient · Delhi' },
    { text: 'Truly a luxury medical experience. Natural elegance and no overfilled look — my friends just ask why my skin looks so rested and radiant.', author: 'S. Mehta', location: 'Verified Patient · Bandra' },
  ]
  const [current, setCurrent] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    const start = () => { timer.current = setInterval(() => setCurrent(c => (c + 1) % slides.length), 5000) }
    start()
    return () => clearInterval(timer.current)
  }, [slides.length])

  const goTo = i => { setCurrent((i + slides.length) % slides.length) }

  return (
    <section id="testimonials" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">{preview ? 'Patient Reflections' : 'Client Testimonials'}</span>
          <h2>Voices of Transformation</h2>
          <p>Read real, heartfelt experiences from clients who entrusted their skin journey to The Skin Tree.</p>
        </div>
        <div
          className="carousel"
          onMouseEnter={() => clearInterval(timer.current)}
          onMouseLeave={() => { timer.current = setInterval(() => setCurrent(c => (c + 1) % slides.length), 5000) }}
        >
          <div className="carousel__track" style={{transform: `translateX(-${current * 100}%)`}}>
            {slides.map((s, i) => (
              <div key={i} className="carousel__slide testimonial-card" style={{ padding: 'clamp(2rem, 5vw, 3rem)' }} aria-hidden={i !== current}>
                <span className="testimonial-card__quote">“</span>
                <p className="testimonial-card__text" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', lineHeight: 1.85, marginBottom: '1.75rem' }}>{s.text}</p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ color: 'var(--c-gold)', fontSize: '1.1rem', letterSpacing: '2px' }}>★★★★★</div>
                  <div className="testimonial-card__meta" style={{ fontSize: '.9rem', color: 'var(--c-text-muted)' }}>{s.location}</div>
                </div>
                <div className="testimonial-card__author" style={{ marginTop: '1.5rem', gap: '1rem' }}>
                  <div className="testimonial-card__avatar" style={{ width: '52px', height: '52px' }}>{s.author[0]}</div>
                  <div>
                    <div className="testimonial-card__name" style={{ fontSize: '1rem' }}>{s.author}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="carousel__nav" style={{ gap: '0.75rem', marginTop: '2.5rem' }}>
            {slides.map((_, i) => (
              <button
                key={i}
                className={`carousel__dot ${i === current ? 'is-active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{ minHeight: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            ))}
          </div>
        </div>

        {preview && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/about" className="btn btn--outline" style={{ minHeight: '48px' }}>Read More Patient Stories & Philosophy →</Link>
          </div>
        )}
      </div>
    </section>
  )
}
