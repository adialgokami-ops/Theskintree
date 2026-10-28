import React from 'react'
import { Link } from 'react-router-dom'

export default function Doctor({ preview = false }) {
  return (
    <section id="doctor" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">{preview ? 'Meet Our Founder' : 'Lead Dermatologist & Medical Director'}</span>
          <h2>Dr. Aishwarya</h2>
        </div>
        <div className="split-layout">
          <div>
            <p className="lead">"My purpose is not simply to treat skin — it is to diagnose root causes and restore skin health through bespoke clinical treatment plans."</p>
            <p>With over 15 years of specialised practice in medical and aesthetic dermatology, Dr. Aishwarya has developed internationally recognised expertise in injectables, lasers and complex skin conditions. Trained at premier institutions in India and with fellowship experience in Paris and Singapore, she blends scientific rigour with aesthetic sensitivity.</p>
            
            {!preview && (
              <ul className="doctor-facts" style={{marginTop:'1.5rem'}}>
                <li><strong>Education:</strong> MBBS, MD Dermatology — All India Institute of Medical Sciences (AIIMS)</li>
                <li><strong>International Fellowship:</strong> Advanced Aesthetic Medicine — Paris & Singapore</li>
                <li><strong>Clinical Specialisations:</strong> Injectable Artistry, Fractional Laser, Anti-Ageing, Complex Acne</li>
                <li><strong>Industry Recognition:</strong> Award-winning Dermatologist — Top Doctor 2022, 2023, 2024</li>
                <li><strong>Accreditation:</strong> Member of International Society of Dermatology & Indian Academy of Dermatologists</li>
              </ul>
            )}

            <div style={{marginTop:'2rem', display: 'flex', flexWrap: 'wrap', gap: '12px'}}>
              {preview ? (
                <Link to="/about" className="btn btn--outline">View all about Dr. Aishwarya & Our Philosophy →</Link>
              ) : (
                <Link to="/contact" className="btn btn--primary">Book a Consultation with Dr. Aishwarya →</Link>
              )}
            </div>
          </div>
          <div>
            <img src="/assets/images/doctor.png" alt="Dr. Aishwarya, Lead Dermatologist at The Skin Tree" style={{borderRadius:'var(--radius-xl)',boxShadow:'var(--shadow-lg)',width:'100%',maxWidth:'480px',margin:'0 auto',display:'block'}} />
          </div>
        </div>
      </div>
    </section>
  )
}
