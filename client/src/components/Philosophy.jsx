import React from 'react'
import { Link } from 'react-router-dom'

export default function Philosophy({ preview = false }) {
  return (
    <section id="philosophy" className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Our Philosophy</span>
          <h2>Skin is more than surface — it is a reflection of your inner vitality.</h2>
          <p>We combine clinical science with nature's wisdom to nurture confidence through evidence-based care and personalised plans.</p>
        </div>
        <div className="grid-3">
          <div className="pillar-card">
            <div className="pillar-card__title">Renewal</div>
            <p className="pillar-card__text">Harnessing the skin's regenerative capacity through advanced therapies that stimulate collagen and restore luminosity.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-card__title">Expertise</div>
            <p className="pillar-card__text">Decades of specialised dermatological training and internationally accredited procedures.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-card__title">Harmony</div>
            <p className="pillar-card__text">Balancing clinical precision with natural aesthetics for results that feel authentically you.</p>
          </div>
        </div>
        {preview && (
          <div style={{textAlign:'center', marginTop:'2.5rem'}}>
            <Link to="/about" className="btn btn--outline">View all About Our Philosophy →</Link>
          </div>
        )}
      </div>
    </section>
  )
}
