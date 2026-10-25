import React, { useEffect, useRef } from 'react'

function formatNumber(value){
  return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

function useCountUp(ref, target, suffix = ''){
  useEffect(()=>{
    if (!ref.current) return
    let started = false
    const el = ref.current
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !started){
          started = true
          const duration = 1200
          const start = performance.now()
          const from = 0
          const to = target
          function step(ts){
            const progress = Math.min((ts - start) / duration, 1)
            const value = from + (to - from) * progress
            el.textContent = (to >= 1000 ? formatNumber(value) : Math.round(value)) + suffix
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
          observer.disconnect()
        }
      })
    }, { threshold: 0.3 })
    observer.observe(el)
    return ()=> observer.disconnect()
  }, [ref, target, suffix])
}

export default function Stats(){
  const ref1 = useRef(null)
  const ref2 = useRef(null)
  const ref3 = useRef(null)
  const ref4 = useRef(null)

  useCountUp(ref1, 5000, '+')
  useCountUp(ref2, 15, '+')
  useCountUp(ref3, 98, '%')
  // last one is 1:1 text; no count

  return (
    <section className="section bg-cream">
      <div className="container">
        <div className="stats-grid" role="list" aria-label="Clinic statistics">
          <div className="stat-item" role="listitem">
            <div className="stat-number" ref={ref1} aria-hidden="false">0+</div>
            <div className="stat-label">Patients Transformed</div>
          </div>

          <div className="stat-item" role="listitem">
            <div className="stat-number" ref={ref2} aria-hidden="false">0+</div>
            <div className="stat-label">Years of Excellence</div>
          </div>

          <div className="stat-item" role="listitem">
            <div className="stat-number" ref={ref3} aria-hidden="false">0%</div>
            <div className="stat-label">Patient Satisfaction</div>
          </div>

          <div className="stat-item" role="listitem">
            <div className="stat-number" ref={ref4}>1:1</div>
            <div className="stat-label">Consultation-First Plans</div>
          </div>
        </div>

        <p className="stat-footnote">Individual results may vary. All images published with full patient consent.</p>
      </div>
    </section>
  )
}
