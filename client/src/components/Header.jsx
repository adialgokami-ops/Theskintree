import React, { useState, useEffect } from 'react'

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const isHome = typeof window !== 'undefined' ? window.location.pathname === '/' : true

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

  const navClass = !isHome
    ? 'navbar is-scrolled'
    : isScrolled
    ? 'navbar navbar--hero is-scrolled'
    : 'navbar navbar--hero'

  return (
    <header className={navClass}>
      <a className="nav-logo" href={isHome ? '#' : '/'}>
        <img src="/assets/images/logo.svg" alt="The Skin Tree logo" className="nav-logo__icon" />
        <div className="nav-logo__text">
          <span className="nav-logo__name">The Skin Tree</span>
          <span className="nav-logo__sub">Luxury Aesthetic Clinic</span>
        </div>
      </a>
      <nav className="nav-menu">
        <a className="nav-link" href={isHome ? '#' : '/#'}>Home</a>
        <a className="nav-link" href={isHome ? '#treatments' : '/#treatments'}>Treatments</a>
        <a className="nav-link" href={isHome ? '#philosophy' : '/#philosophy'}>About</a>
        <a className="nav-link" href={isHome ? '#gallery' : '/#gallery'}>Gallery</a>
        <a className="nav-link" href={isHome ? '#booking' : '/#booking'}>Contact</a>
        <a className="nav-cta" href={isHome ? '#booking' : '/#booking'}>Book Now</a>
      </nav>

      <button id="nav-hamburger" className="nav-hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div id="nav-mobile-menu" className="nav-mobile-menu" aria-hidden="true">
        <a className="nav-link" href={isHome ? '#' : '/#'}>Home</a>
        <a className="nav-link" href={isHome ? '#treatments' : '/#treatments'}>Treatments</a>
        <a className="nav-link" href={isHome ? '#philosophy' : '/#philosophy'}>About</a>
        <a className="nav-link" href={isHome ? '#gallery' : '/#gallery'}>Gallery</a>
        <a className="nav-link" href={isHome ? '#booking' : '/#booking'}>Contact</a>
        <a className="nav-cta" href={isHome ? '#booking' : '/#booking'}>Book Now</a>
      </div>
    </header>
  )
}
