import React, { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 40)
          ticking = false
        })
        ticking = true
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  const navClass = isScrolled
    ? 'navbar navbar--hero is-scrolled'
    : 'navbar navbar--hero'

  const closeMenu = () => setIsMobileOpen(false)

  return (
    <header className={navClass}>
      <Link className="nav-logo" to="/">
        <img src="/assets/images/logo.svg" alt="The Skin Tree logo" className="nav-logo__icon" />
        <div className="nav-logo__text">
          <span className="nav-logo__name">The Skin Tree</span>
          <span className="nav-logo__sub">Luxury Aesthetic Clinic</span>
        </div>
      </Link>

      <nav className="nav-menu">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Home</NavLink>
        <NavLink to="/treatments" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Treatments</NavLink>
        <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>About</NavLink>
        <NavLink to="/gallery" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Gallery</NavLink>
        <NavLink to="/contact" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Contact</NavLink>
        <Link to="/contact" className="nav-cta">Book Now</Link>
      </nav>

      <button
        id="nav-hamburger"
        className={`nav-hamburger ${isMobileOpen ? 'is-open' : ''}`}
        aria-label="Open menu"
        aria-expanded={isMobileOpen}
        onClick={() => setIsMobileOpen(open => !open)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div id="nav-mobile-menu" className={`nav-mobile-menu ${isMobileOpen ? 'is-open' : ''}`} aria-hidden={!isMobileOpen}>
        <NavLink to="/" end className="nav-link" onClick={closeMenu}>Home</NavLink>
        <NavLink to="/treatments" className="nav-link" onClick={closeMenu}>Treatments</NavLink>
        <NavLink to="/about" className="nav-link" onClick={closeMenu}>About</NavLink>
        <NavLink to="/gallery" className="nav-link" onClick={closeMenu}>Gallery</NavLink>
        <NavLink to="/contact" className="nav-link" onClick={closeMenu}>Contact</NavLink>
        <Link to="/contact" className="nav-cta" onClick={closeMenu}>Book Now</Link>
      </div>
    </header>
  )
}
