import React from 'react'

export default function Header() {
  return (
    <header className="navbar">
      <a className="nav-logo" href="#">
        <img src="/assets/images/logo.svg" alt="logo" className="nav-logo__icon" />
        <div className="nav-logo__text">
          <span className="nav-logo__name">The Skin Tree</span>
          <span className="nav-logo__sub">Wellness & Beauty</span>
        </div>
      </a>
      <nav className="nav-menu">
        <a className="nav-link" href="#treatments">Treatments</a>
        <a className="nav-link" href="#gallery">Gallery</a>
        <a className="nav-link" href="#testimonials">Testimonials</a>
        <a className="nav-cta" href="#booking">Book</a>
      </nav>

      <button id="nav-hamburger" className="nav-hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div id="nav-mobile-menu" className="nav-mobile-menu" aria-hidden="true">
        <a className="nav-link" href="#treatments">Treatments</a>
        <a className="nav-link" href="#gallery">Gallery</a>
        <a className="nav-link" href="#testimonials">Testimonials</a>
        <a className="nav-cta" href="#booking">Book</a>
      </div>
    </header>
  )
}
