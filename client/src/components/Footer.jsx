import React from 'react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <div className="footer__brand-name">The Skin Tree</div>
          <p className="footer__brand-desc">Where advanced dermatological science meets the restorative power of nature.</p>
          <div className="footer__socials">
            <a className="footer__social-link" href="#">Instagram</a>
            <a className="footer__social-link" href="#">Facebook</a>
            <a className="footer__social-link" href="#">WhatsApp</a>
          </div>
        </div>
        <div>
          <div className="footer__col-title">Treatments</div>
          <div className="footer__links">
            <a className="footer__link" href="#treatments">Botox & Toxins</a>
            <a className="footer__link" href="#treatments">Dermal Fillers</a>
            <a className="footer__link" href="#treatments">Laser Therapy</a>
          </div>
        </div>
        <div>
          <div className="footer__col-title">Clinic</div>
          <div className="footer__links">
            <a className="footer__link" href="#">About Us</a>
            <a className="footer__link" href="#">Contact</a>
          </div>
        </div>
        <div>
          <div className="footer__col-title">Contact</div>
          <div className="footer__contact-item">
            <div className="footer__contact-icon">📞</div>
            <div>
              <div>+91 98765 43210</div>
              <div className="footer__meta">123 Serenity Lane, Bandra West, Mumbai</div>
            </div>
          </div>
          <div className="footer__newsletter">
            <input placeholder="Your email" />
            <button>Subscribe</button>
          </div>
        </div>
      </div>
      <div className="container footer__bottom">
        <div className="footer__copy">© {new Date().getFullYear()} The Skin Tree — Luxury Aesthetic Clinic</div>
        <div className="footer__legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms</a>
          <a href="/disclaimer">Medical Disclaimer</a>
        </div>
      </div>
    </footer>
  )
}
