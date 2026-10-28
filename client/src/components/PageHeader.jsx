import React from 'react'

export default function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <section className="page-header">
      <div className="container">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__sub">{subtitle}</p>}
      </div>
    </section>
  )
}
