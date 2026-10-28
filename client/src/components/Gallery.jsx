import React, { useState } from 'react'
import { Link } from 'react-router-dom'

function Lightbox({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div
      className="lightbox"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(44,24,16,.92)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <img src={src} alt={alt} style={{maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain'}} />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          width: 44,
          height: 44,
          borderRadius: '50%',
          cursor: 'pointer'
        }}
        aria-label="Close image preview"
      >
        ✕
      </button>
    </div>
  )
}

export default function Gallery({ preview = false }) {
  const imgs = [
    { src: '/assets/images/treatment.png', caption: 'Clinical Procedure — Precision Laser & Facial Sculpting' },
    { src: '/assets/images/clinic.png', caption: 'The Sanctuary — Consultation & Diagnosis Suite' },
    { src: '/assets/images/doctor.png', caption: 'Dr. Aishwarya — Bespoke Facial Assessment' },
    { src: '/assets/images/hero.png', caption: 'State-of-the-Art Aesthetic Treatment Room' }
  ]
  const [lb, setLb] = useState(null)

  return (
    <section id="gallery" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">{preview ? 'Visual Highlights' : 'Our Sanctuary & Clinical Work'}</span>
          <h2>{preview ? 'Clinic & Results Preview' : 'Gallery & Patient Journeys'}</h2>
          <p>Explore our state-of-the-art clinic suites and authentic patient transformation environments.</p>
        </div>
        <div className="gallery-grid">
          {imgs.map((it, i) => (
            <figure
              key={i}
              className="gallery-item"
              data-lightbox={it.src}
              data-caption={it.caption}
              onClick={() => setLb(it.src)}
              style={{cursor: 'pointer'}}
            >
              <img src={it.src} alt={it.caption} loading="lazy" />
              <figcaption className="gallery-caption">{it.caption}</figcaption>
            </figure>
          ))}
        </div>

        {preview ? (
          <div style={{textAlign: 'center', marginTop: '2.5rem'}}>
            <Link to="/gallery" className="btn btn--outline">View Full Clinic & Results Gallery →</Link>
          </div>
        ) : (
          <div style={{textAlign: 'center', marginTop: '3.5rem'}}>
            <p style={{color: 'var(--c-text-muted)', marginBottom: '1.5rem'}}>
              Ready to begin your personal aesthetic journey with us?
            </p>
            <Link to="/contact" className="btn btn--primary">Book a Private Consultation →</Link>
          </div>
        )}
      </div>
      <Lightbox src={lb} alt="Expanded preview" onClose={() => setLb(null)} />
    </section>
  )
}
