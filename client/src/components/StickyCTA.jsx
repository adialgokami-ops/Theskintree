import React from 'react'
import { Link } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'

export default function StickyCTA(){
  return (
    <Link
      className="sticky-cta"
      to="/contact"
      onClick={() => trackEvent('cta_click', { label: 'Book Now (sticky)' })}
      aria-label="Book now"
    >
      Book Now
    </Link>
  )
}
