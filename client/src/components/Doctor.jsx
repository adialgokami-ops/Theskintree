import React from 'react'

export default function Doctor(){
  return (
    <section id="doctor" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Meet</span>
          <h2>Dr. Amara Patel — Lead Dermatologist</h2>
        </div>
        <div className="split-layout">
          <div>
            <p className="lead">"My purpose is not simply to treat skin — it is to restore confidence, and through it, transform lives."</p>
            <p>With over 15 years of specialised practice in medical and aesthetic dermatology, Dr. Amara Patel has developed internationally recognised expertise in injectables, lasers and complex skin conditions. Trained at premier institutions in India and with fellowship experience in Paris and Singapore, she blends scientific rigour with aesthetic sensitivity.</p>
            <ul className="doctor-facts">
              <li><strong>Education:</strong> MBBS, MD Dermatology — All India Institute of Medical Sciences</li>
              <li><strong>International Fellowship:</strong> Aesthetic Medicine — Paris & Singapore</li>
              <li><strong>Specialisations:</strong> Injectables, Laser Therapy, Anti-Ageing, Acne Management</li>
              <li><strong>Recognition:</strong> Award-winning Dermatologist — Top Doctor 2022, 2023, 2024</li>
            </ul>
            <p><a href="#philosophy" className="btn btn--outline">Full Profile & Philosophy →</a></p>
          </div>
          <div>
            <img src="/assets/images/doctor.png" alt="Dr. Amara Patel, Lead Dermatologist at The Skin Tree" />
          </div>
        </div>
      </div>
    </section>
  )
}
