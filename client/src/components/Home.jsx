import React from 'react'
import Gallery from './Gallery'
import Booking from './Booking'
import Testimonials from './Testimonials'
import Treatments from './Treatments'
import Philosophy from './Philosophy'
import Transformations from './Transformations'
import Doctor from './Doctor'
import Stats from './Stats'

export default function Home() {
  return (
    <div>
      <section className="section section-hero bg-off-white">
        <div className="container split-layout">
          <div>
            <h1 className="display-text">Nurturing Beauty <span className="accent-text">from</span> Within.</h1>
            <p className="text-muted">Where advanced dermatological science meets the restorative power of nature — every treatment, a deeply personal journey.</p>
            <a className="btn btn--primary hero-cta" href="#booking">Book a Private Consultation</a>
            <div className="hero-trust">
              <div className="dot" aria-hidden="true"></div>
              <div>Dr. Amara Patel · MBBS, MD Dermatology · 15+ years' experience</div>
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

      <Doctor />

      <Philosophy />

      <Transformations />

      <Stats />

      <Treatments />

      <Gallery />

      <Testimonials />

      <Booking />
    </div>
  )
}
