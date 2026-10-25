import React from 'react'
import { trackEvent } from '../lib/analytics'

export default function StickyCTA(){
  return (
    <a className="sticky-cta" href="#booking" onClick={() => trackEvent('cta_click', { label: 'Book Now (sticky)' })} aria-label="Book now">Book Now</a>
  )
}
