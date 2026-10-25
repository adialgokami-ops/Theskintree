import React, { useEffect, useRef, useState } from 'react'

export default function Testimonials() {
  const slides = [
    { text: "Five stars simply isn't enough. The clinic is breathtakingly beautiful, the staff impeccably professional, and my results are nothing short of miraculous.", author: 'Riya M.' },
    { text: 'Highly recommended — the team is expert and empathetic.', author: 'R. Gupta' },
    { text: 'Truly a luxury experience with medical-grade care.', author: 'S. Mehta' },
  ]
  const [current, setCurrent] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    const start = () => { timer.current = setInterval(() => setCurrent(c => (c + 1) % slides.length), 5000) }
    start()
    return () => clearInterval(timer.current)
  }, [])

  const goTo = i => { setCurrent((i + slides.length) % slides.length) }

  return (
    <section id="testimonials" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Testimonials</span>
          <h2>Happy Clients</h2>
        </div>
        <div className="carousel" onMouseEnter={() => clearInterval(timer.current)} onMouseLeave={() => { timer.current = setInterval(() => setCurrent(c => (c + 1) % slides.length), 5000) }}>
          <div className="carousel__track" style={{transform:`translateX(-${current * 100}%)`}}>
            {slides.map((s, i) => (
              <div key={i} className="carousel__slide testimonial-card" aria-hidden={i!==current}>
                  <span className="testimonial-card__quote">“</span>
                  <p className="testimonial-card__text">{s.text}</p>
                  <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{color:'var(--c-gold)'}}>★★★★★</div>
                    <div className="testimonial-card__meta" style={{fontSize:'.85rem',color:'var(--c-text-muted)'}}>Verified · Delhi</div>
                  </div>
                  <div className="testimonial-card__author" style={{marginTop:12}}>
                    <div className="testimonial-card__avatar">{s.author[0]}</div>
                    <div>
                      <div className="testimonial-card__name">{s.author}</div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
          <div className="carousel__nav">
            {slides.map((_, i) => <button key={i} className={`carousel__dot ${i===current? 'is-active':''}`} onClick={() => goTo(i)} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
