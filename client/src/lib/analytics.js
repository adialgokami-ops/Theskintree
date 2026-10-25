export function trackEvent(name, payload = {}){
  try{
    if (window && window.dataLayer && typeof window.dataLayer.push === 'function'){
      window.dataLayer.push({ event: name, ...payload })
    } else {
      // graceful fallback for dev
      console.info('analytics:', name, payload)
    }
  }catch(e){ console.warn('analytics error', e) }
}
