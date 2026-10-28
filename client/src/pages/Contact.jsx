import React from 'react'
import PageHeader from '../components/PageHeader'
import Booking from '../components/Booking'
import { getClinicWhatsApp } from '../lib/config.js'

export default function Contact() {
  const clinicWhatsApp = getClinicWhatsApp()
  const cleanWa = clinicWhatsApp ? clinicWhatsApp.replace(/\D/g, '') : ''
  return (
    <div className="page-contact">
      <PageHeader
        eyebrow="Connect With Us"
        title="Contact & Private Bookings"
        subtitle="Visit our sanctuary in Bandra West, Mumbai, or reserve your bespoke aesthetic consultation below."
      />

      <section className="section bg-off-white">
        <div className="container">
          <div className="split-layout" style={{alignItems: 'start'}}>
            {/* Clinic Details Column */}
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: '0.5rem' }}>Our Sanctuary</span>
              <h2 style={{ marginBottom: '1.25rem', lineHeight: 1.25 }}>The Skin Tree Clinic</h2>
              <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.8, fontSize: '1rem', marginBottom: '2.5rem' }}>
                A discrete, serene clinical environment crafted for rejuvenation, privacy, and the highest standards of dermatological excellence.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.75rem', color: 'var(--c-terracotta)', lineHeight: 1 }}>📍</div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--c-text-primary)', marginBottom: 4, fontSize: '1rem' }}>Address</strong>
                    <span style={{ color: 'var(--c-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                      123 Serenity Lane, Off Turner Road,<br />Bandra West, Mumbai, MH 400050
                    </span>
                  </div>
                </div>

                {clinicWhatsApp ? (
                  <>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '1.75rem', color: 'var(--c-terracotta)', lineHeight: 1 }}>📞</div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--c-text-primary)', marginBottom: 4, fontSize: '1rem' }}>Telephone</strong>
                        <a href={`tel:${clinicWhatsApp.replace(/\s+/g, '')}`} style={{ color: 'var(--c-terracotta)', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>
                          {clinicWhatsApp}
                        </a>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '1.75rem', color: 'var(--c-terracotta)', lineHeight: 1 }}>💬</div>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--c-text-primary)', marginBottom: 4, fontSize: '1rem' }}>WhatsApp Concierge</strong>
                        <a
                          href={`https://wa.me/${cleanWa}?text=Hello%20The%20Skin%20Tree,%20I%20would%20like%20to%20inquire%20about%20a%20consultation`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--outline btn--sm"
                          style={{ marginTop: 8, display: 'inline-flex', minHeight: '42px', padding: '0.65rem 1.25rem' }}
                        >
                          Chat on WhatsApp →
                        </a>
                      </div>
                    </div>
                  </>
                ) : null}

                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.75rem', color: 'var(--c-terracotta)', lineHeight: 1 }}>🕒</div>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--c-text-primary)', marginBottom: 4, fontSize: '1rem' }}>Opening Hours</strong>
                    <div style={{ color: 'var(--c-text-muted)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                      <div><strong>Monday – Saturday:</strong> 09:30 AM – 07:30 PM</div>
                      <div><strong>Sunday:</strong> Closed (Emergency / By Special Appointment)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--c-cream)', padding: '1.5rem 1.75rem', borderRadius: 16, border: '1px solid var(--c-border-light)' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: 8, color: 'var(--c-umber)' }}>Valet & Privacy</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--c-text-muted)', margin: 0, lineHeight: 1.7 }}>
                  Complimentary private valet parking available on arrival. Private consultation entrances available upon request for VIP discretion.
                </p>
              </div>
            </div>

            {/* Interactive Booking Column */}
            <div>
              <Booking hideHeader={false} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
