import React, { useState } from 'react'

function Lightbox({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div className="lightbox" style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(44,24,16,.9)'}} onClick={onClose}>
      <img src={src} alt={alt} style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,objectFit:'contain'}} />
      <button onClick={onClose} style={{position:'absolute',top:16,right:16}}>✕</button>
    </div>
  )
}

export default function Gallery() {
  const imgs = [
    { src:'/assets/images/treatment.png', caption:'Treatment — Before' },
    { src:'/assets/images/clinic.png', caption:'Clinic — Consultation Suite' },
    { src:'/assets/images/doctor.png', caption:'Dr. Amara Patel — Consultation' },
    { src:'/assets/images/hero.png', caption:'Advanced Treatment Room' }
  ]
  const [lb, setLb] = useState(null)

  return (
    <section id="gallery" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Gallery</span>
          <h2>Before & After</h2>
        </div>
        <div className="gallery-grid">
          {imgs.map((it, i) => (
            <figure key={i} className="gallery-item" data-lightbox={it.src} data-caption={it.caption} onClick={() => setLb(it.src)}>
              <img src={it.src} alt={it.caption} />
              <figcaption className="gallery-caption">{it.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <Lightbox src={lb} alt="" onClose={() => setLb(null)} />
    </section>
  )
}
