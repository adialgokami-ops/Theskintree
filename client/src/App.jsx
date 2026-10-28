import React, { useEffect } from 'react'
import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ChatWidget from './components/ChatWidget'

// Pages
import Home from './components/Home'
import About from './pages/About'
import TreatmentsPage from './pages/TreatmentsPage'
import GalleryPage from './pages/GalleryPage'
import Contact from './pages/Contact'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Disclaimer from './pages/Disclaimer'
import ManageBooking from './pages/ManageBooking'

export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function Layout() {
  return (
    <div className="app-layout">
      <ScrollToTop />
      <Header />
      <main>
        <Outlet />
      </main>
      <ChatWidget />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/treatments" element={<TreatmentsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/manage/:token" element={<ManageBooking />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
