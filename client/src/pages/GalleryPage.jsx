import React from 'react'
import PageHeader from '../components/PageHeader'
import Transformations from '../components/Transformations'
import Gallery from '../components/Gallery'

export default function GalleryPage() {
  return (
    <div className="page-gallery">
      <PageHeader
        eyebrow="Visual Proof & Sanctuary"
        title="Transformations & Clinic Gallery"
        subtitle="Authentic clinical results from consenting patients alongside glimpses into our private consultation suites."
      />

      <Transformations preview={false} />

      <Gallery preview={false} />
    </div>
  )
}
