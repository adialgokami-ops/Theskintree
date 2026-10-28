import React from 'react'
import { Link } from 'react-router-dom'
import Doctor from './Doctor'
import Philosophy from './Philosophy'
import Stats from './Stats'
import Treatments from './Treatments'
import Transformations from './Transformations'
import Gallery from './Gallery'
import Testimonials from './Testimonials'

export default function Home() {
  return (
    <div className="page-home">
      {/* Existing Hero Section */}
      <section className="section section-hero bg-off-white">
        <div className="container split-layout">
          <div>
            <h1 className="display-text">Nurturing Beauty <span className="accent-text">from</span> Within.</h1>
            <p className="text-muted">Where advanced dermatological science meets the restorative power of nature — every treatment, a deeply personal journey.</p>
            <Link className="btn btn--primary hero-cta" to="/contact">Book a Private Consultation</Link>
            <div className="hero-trust">
              <div className="dot" aria-hidden="true"></div>
              <div>Dr. Aishwarya · MBBS, MD Dermatology · 15+ years' experience</div>
            </div>
          </div>
          <div>
            <div className="hero-card">
              <img src="/assets/images/clinic.png" alt="treatment" />
              <div className="card-eyebrow">Signature Experience</div>
              <div className="card-title">Personalised Skin Journey</div>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor teaser + Philosophy pillars -> /about */}
      <Doctor preview={true} />
      <Philosophy preview={true} />

      {/* Stats preserved on Home */}
      <Stats />

      {/* 3 featured treatments -> /treatments */}
      <Treatments preview={true} />

      {/* 1 before/after slider + 4-image strip -> /gallery */}
      <Transformations preview={true} />
      <Gallery preview={true} />

      {/* 1-3 testimonials -> /about */}
      <Testimonials preview={true} />

      {/* Slim "Book a consultation" CTA band -> /contact */}
      <section className="section bg-cream slim-cta-band" style={{ padding: 'clamp(4rem, 8vw, 6rem) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 780 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '0.75rem' }}>Personalised Aesthetic Excellence</span>
          <h2 style={{ margin: '0.5rem 0 1.25rem', lineHeight: 1.25 }}>Ready for Your Transformation?</h2>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: '2.5rem', lineHeight: 1.8, fontSize: '1.05rem' }}>
            Take the first step toward radiant, healthy skin with a bespoke clinical consultation with Dr. Aishwarya.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg" style={{ minHeight: '52px' }}>
            Book a Consultation →
          </Link>
        </div>
      </section>
    </div>
  )
}
