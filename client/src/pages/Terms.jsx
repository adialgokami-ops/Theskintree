import React from 'react'
import PageHeader from '../components/PageHeader'

export default function Terms() {
  return (
    <div className="page-legal">
      <PageHeader
        eyebrow="Legal & Compliance"
        title="Terms of Service"
        subtitle="Clinic policies, appointment guidelines, and terms governing treatment engagements."
      />

      <section className="section bg-off-white">
        <div className="container" style={{maxWidth: 860, lineHeight: 1.8, color: 'var(--c-text-primary)'}}>
          <p className="lead" style={{color: 'var(--c-text-secondary)', marginBottom: '1.5rem'}}>
            Welcome to The Skin Tree. By using our website or scheduling treatments at our clinic, you agree to the following terms and clinical policies.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>1. Consultations & Treatment Suitability</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            All procedures are subject to medical evaluation. Our dermatologists reserve the professional right to decline or modify treatments if deemed clinically unsuitable or unsafe for a patient.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>2. Appointment Cancellations & Rescheduling</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            Because consultation time is reserved exclusively for each patient, we request at least 24 hours advance notice for cancellations or rescheduling to avoid cancellation charges.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>3. Payments & Fees</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            Treatment pricing is transparently communicated following consultation and prior to any procedure. Payment is due upon completion of each session.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>4. Changes to Terms</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            The Skin Tree reserves the right to update these terms to reflect evolving clinical guidelines and local regulations.
          </p>
        </div>
      </section>
    </div>
  )
}
