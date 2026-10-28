import React from 'react'
import { Link } from 'react-router-dom'
import { getClinicWhatsApp } from '../lib/config.js'

export default function Footer() {
  const waNum = getClinicWhatsApp()
  const waHref = waNum ? `https://wa.me/${waNum.replace(/\D/g, '')}` : '#'

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <Link to="/" className="footer__brand-name" style={{display:'inline-block',textDecoration:'none'}}>The Skin Tree</Link>
          <p className="footer__brand-desc">Where advanced dermatological science meets the restorative power of nature.</p>
          <div className="footer__socials">
            <a className="footer__social-link" href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
            <a className="footer__social-link" href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>
            {waNum && (
              <a className="footer__social-link" href={waHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a>
            )}
          </div>
        </div>
        <div>
          <div className="footer__col-title">Treatments</div>
          <div className="footer__links">
            <Link className="footer__link" to="/treatments">All Signature Treatments</Link>
            <Link className="footer__link" to="/treatments">Botox & Toxins</Link>
            <Link className="footer__link" to="/treatments">Dermal Fillers</Link>
            <Link className="footer__link" to="/treatments">Laser Therapy</Link>
          </div>
        </div>
        <div>
          <div className="footer__col-title">Clinic</div>
          <div className="footer__links">
            <Link className="footer__link" to="/about">About Us</Link>
            <Link className="footer__link" to="/gallery">Gallery & Results</Link>
            <Link className="footer__link" to="/contact">Contact & Booking</Link>
          </div>
        </div>
        <div>
          <div className="footer__col-title">Contact</div>
          <div className="footer__contact-item">
            <div className="footer__contact-icon">📞</div>
            <div>
              <a href="tel:+919876543210" style={{color:'inherit',textDecoration:'none'}}>+91 98765 43210</a>
              <div className="footer__meta">123 Serenity Lane, Bandra West, Mumbai</div>
            </div>
          </div>
          <div className="footer__newsletter">
            <input placeholder="Your email" aria-label="Your email for newsletter" />
            <button type="button">Subscribe</button>
          </div>
        </div>
      </div>
      <div className="container footer__bottom">
        <div className="footer__copy">© {new Date().getFullYear()} The Skin Tree — Luxury Aesthetic Clinic</div>
        <div className="footer__legal">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/disclaimer">Medical Disclaimer</Link>
        </div>
      </div>
    </footer>
  )
}
