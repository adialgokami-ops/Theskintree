import React from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './components/Home'
import Privacy from './components/Privacy'
import Terms from './components/Terms'
import Disclaimer from './components/Disclaimer'
import StickyCTA from './components/StickyCTA'

function Router(){
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (path === '/privacy') return <Privacy />
  if (path === '/terms') return <Terms />
  if (path === '/disclaimer') return <Disclaimer />
  return <Home />
}

export default function App() {
  const isHome = typeof window !== 'undefined' ? window.location.pathname === '/' : true
  return (
    <div>
      <Header />
      <main className={isHome ? '' : 'main-subpage'}>
        <Router />
      </main>
      <StickyCTA />
      <Footer />
    </div>
  )
}
