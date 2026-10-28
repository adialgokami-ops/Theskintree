import React from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Treatments from '../components/Treatments'

export default function TreatmentsPage() {
  return (
    <div className="page-treatments">
      <PageHeader
        eyebrow="Clinical Portfolio"
        title="Signature Aesthetic Treatments"
        subtitle="Precision protocols designed to restore natural facial harmony, stimulate collagen, and nurture youthful vitality."
      />

      <Treatments preview={false} />

      <section className="section bg-off-white" style={{ padding: 'clamp(4rem, 8vw, 6rem) 0', borderTop: '1px solid var(--c-border-light)' }}>
        <div className="container" style={{ maxWidth: 800, textAlign: 'center' }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '0.75rem' }}>Diagnose First, Treat Second</span>
          <h2 style={{ margin: '0.5rem 0 1.25rem', lineHeight: 1.25 }}>Book a Comprehensive Skin Assessment</h2>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: '2.5rem', lineHeight: 1.8, fontSize: '1.05rem' }}>
            You never need to decide on treatments alone. Dr. Aishwarya conducts in-depth anatomical mapping and skin health evaluations to craft a bespoke multi-modality treatment plan tailored exclusively to your goals.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg" style={{ minHeight: '52px' }}>
            Book an Initial Consultation →
          </Link>
        </div>
      </section>
    </div>
  )
}
