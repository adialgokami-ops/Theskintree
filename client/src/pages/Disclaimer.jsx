import React from 'react'
import PageHeader from '../components/PageHeader'

export default function Disclaimer() {
  return (
    <div className="page-legal">
      <PageHeader
        eyebrow="Legal & Medical Transparency"
        title="Medical Disclaimer"
        subtitle="Important information regarding dermatological treatments and individual outcomes."
      />

      <section className="section bg-off-white">
        <div className="container" style={{maxWidth: 860, lineHeight: 1.8, color: 'var(--c-text-primary)'}}>
          <p className="lead" style={{color: 'var(--c-text-secondary)', marginBottom: '1.5rem'}}>
            Please read this medical disclosure carefully prior to booking or undergoing any aesthetic or dermatological treatment.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>1. Informational Purposes Only</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            Content on this website, including procedure descriptions, before & after photographs, and articles, is published solely for educational and informational purposes. It does not constitute formal medical diagnosis or replace personalized medical advice.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>2. Individual Variance in Outcomes</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            Skin biology, healing times, and clinical results differ per individual based on genetics, lifestyle, age, adherence to aftercare protocols, and anatomical baseline. No aesthetic clinic can legally or ethically guarantee identical results for any procedure.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>3. Informed Consent & Potential Risks</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            All invasive, non-invasive, and injectable procedures carry inherent medical risks (such as temporary bruising, erythema, swelling, or rare adverse events). A formal consultation and informed consent form are required before any treatment is performed.
          </p>

          <h3 style={{marginTop: '2rem', marginBottom: '0.75rem'}}>4. Practitioner Credentials</h3>
          <p style={{color: 'var(--c-text-muted)'}}>
            All aesthetic medical procedures at The Skin Tree are supervised and performed by qualified, registered dermatologists and medical aesthetic practitioners holding valid board certifications.
          </p>
        </div>
      </section>
    </div>
  )
}
