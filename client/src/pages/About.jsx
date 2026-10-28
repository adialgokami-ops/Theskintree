import React from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Doctor from '../components/Doctor'
import Philosophy from '../components/Philosophy'
import Testimonials from '../components/Testimonials'

export default function About() {
  return (
    <div className="page-about">
      <PageHeader
        eyebrow="About The Skin Tree"
        title="Science, Artistry & Restorative Care"
        subtitle="Led by Dr. Aishwarya, our sanctuary blends world-class medical dermatology with tailored facial aesthetic design."
      />

      <Doctor preview={false} />

      <Philosophy preview={false} />

      <Testimonials preview={false} />

      <section className="section bg-cream" style={{ textAlign: 'center', padding: 'clamp(4rem, 8vw, 6rem) 0' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '0.75rem' }}>Personalised Treatment</span>
          <h2 style={{ margin: '0.5rem 0 1.25rem', lineHeight: 1.25 }}>Begin Your Journey</h2>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: '2.5rem', lineHeight: 1.8, fontSize: '1.05rem' }}>
            Every transformation starts with a thorough, unhurried 1:1 clinical consultation with Dr. Aishwarya to diagnose your skin and curate a bespoke treatment plan.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg" style={{ minHeight: '52px' }}>
            Schedule a Private Consultation →
          </Link>
        </div>
      </section>
    </div>
  )
}
