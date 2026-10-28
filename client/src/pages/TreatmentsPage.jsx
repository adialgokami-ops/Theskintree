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

      <section className="section bg-off-white" style={{padding: '4rem 0', borderTop: '1px solid var(--c-border-light)'}}>
        <div className="container" style={{maxWidth: 800, textAlign: 'center'}}>
          <span className="eyebrow">Diagnose First, Treat Second</span>
          <h2 style={{margin: '0.5rem 0 1rem'}}>Book a Comprehensive Skin Assessment</h2>
          <p style={{color: 'var(--c-text-muted)', marginBottom: '2rem'}}>
            You never need to decide on treatments alone. Dr. Aishwarya conducts in-depth anatomical mapping and skin health evaluations to craft a bespoke multi-modality treatment plan tailored exclusively to your goals.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg">
            Book an Initial Consultation →
          </Link>
        </div>
      </section>
    </div>
  )
}
