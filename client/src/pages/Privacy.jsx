import React from 'react';
import PageHeader from '../components/PageHeader';

export default function Privacy() {
  return (
    <div className="page-legal">
      <PageHeader
        eyebrow="Notice"
        title="Privacy & Data Notice"
        subtitle="How The Skin Tree collects, protects, and handles appointment details and personal contact information."
      />

      <section className="section bg-off-white">
        <div className="container" style={{ maxWidth: 860, lineHeight: 1.8, color: 'var(--c-text-primary)' }}>
          {/* Mandatory Draft Notice Banner */}
          <div style={{
            background: '#FFF5EB',
            border: '1.5px solid var(--c-terracotta)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h4 style={{ color: 'var(--c-terracotta-dark)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
              DRAFT NOTICE — PENDING QUALIFIED REVIEW
            </h4>
            <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--c-text-secondary)', lineHeight: 1.6 }}>
              This policy document is a developmental draft template. It must be formally reviewed and tailored by a qualified healthcare legal and privacy professional before live patient operations begin. We make no warranty of regulatory compliance in this draft state.
            </p>
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>1. Scheduling Information We Collect</h3>
          <p style={{ color: 'var(--c-text-muted)' }}>
            When reserving a consultation slot via our website or messaging assistant, we collect basic contact information: full name, telephone number, optional email address, and general consultation reason.
          </p>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>2. Data Segregation & Protection</h3>
          <p style={{ color: 'var(--c-text-muted)' }}>
            To safeguard privacy, scheduling identities are stored in isolated databases. Health assessments and diagnostic evaluations remain strictly confidential and accessible solely by authorised healthcare practitioners during private consultations.
          </p>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>3. Appointment Communication & Reminders</h3>
          <p style={{ color: 'var(--c-text-muted)' }}>
            We use your telephone number and email exclusively for appointment confirmations, schedule updates, and generic reminders. Patient reminders are sent only with prior consent and contain no sensitive health details. We do not sell or disclose patient contact details to third parties.
          </p>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>4. Questions & Erasure Requests</h3>
          <p style={{ color: 'var(--c-text-muted)' }}>
            To request review or erasure of your contact record, please reach our administrative team at{' '}
            <a href="mailto:privacy@theskintree.in" style={{ color: 'var(--c-terracotta)', fontWeight: 600 }}>
              privacy@theskintree.in
            </a>.
          </p>
        </div>
      </section>
    </div>
  );
}
