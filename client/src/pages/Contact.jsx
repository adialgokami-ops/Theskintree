import React from 'react'
import PageHeader from '../components/PageHeader'
import Booking from '../components/Booking'

export default function Contact() {
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
              <span className="eyebrow">Our Sanctuary</span>
              <h2 style={{marginBottom: '1rem'}}>The Skin Tree Clinic</h2>
              <p style={{color: 'var(--c-text-muted)', lineHeight: 1.7, marginBottom: '2rem'}}>
                A discrete, serene clinical environment crafted for rejuvenation, privacy, and the highest standards of dermatological excellence.
              </p>

              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem'}}>
                <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                  <div style={{fontSize: '1.5rem', color: 'var(--c-terracotta)'}}>📍</div>
                  <div>
                    <strong style={{display: 'block', color: 'var(--c-text-primary)', marginBottom: 2}}>Address</strong>
                    <span style={{color: 'var(--c-text-muted)', lineHeight: 1.6}}>
                      123 Serenity Lane, Off Turner Road,<br />Bandra West, Mumbai, MH 400050
                    </span>
                  </div>
                </div>

                <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                  <div style={{fontSize: '1.5rem', color: 'var(--c-terracotta)'}}>📞</div>
                  <div>
                    <strong style={{display: 'block', color: 'var(--c-text-primary)', marginBottom: 2}}>Telephone</strong>
                    <a href="tel:+919876543210" style={{color: 'var(--c-terracotta)', fontWeight: 600, textDecoration: 'none'}}>
                      +91 98765 43210
                    </a>
                  </div>
                </div>

                <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                  <div style={{fontSize: '1.5rem', color: 'var(--c-terracotta)'}}>💬</div>
                  <div>
                    <strong style={{display: 'block', color: 'var(--c-text-primary)', marginBottom: 2}}>WhatsApp Concierge</strong>
                    <a
                      href="https://wa.me/919876543210?text=Hello%20The%20Skin%20Tree,%20I%20would%20like%20to%20inquire%20about%20a%20consultation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--outline btn--sm"
                      style={{marginTop: 6, display: 'inline-flex'}}
                    >
                      Chat on WhatsApp →
                    </a>
                  </div>
                </div>

                <div style={{display: 'flex', gap: '1rem', alignItems: 'flex-start'}}>
                  <div style={{fontSize: '1.5rem', color: 'var(--c-terracotta)'}}>🕒</div>
                  <div>
                    <strong style={{display: 'block', color: 'var(--c-text-primary)', marginBottom: 2}}>Opening Hours</strong>
                    <div style={{color: 'var(--c-text-muted)', fontSize: '0.92rem', lineHeight: 1.6}}>
                      <div><strong>Monday – Saturday:</strong> 09:30 AM – 07:30 PM</div>
                      <div><strong>Sunday:</strong> Closed (Emergency / By Special Appointment)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{background: 'var(--c-cream)', padding: '1.25rem 1.5rem', borderRadius: 12}}>
                <h4 style={{fontSize: '0.95rem', marginBottom: 6}}>Valet & Privacy</h4>
                <p style={{fontSize: '0.875rem', color: 'var(--c-text-muted)', margin: 0, lineHeight: 1.6}}>
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
