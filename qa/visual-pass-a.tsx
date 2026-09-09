import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { GardenPage } from '../src/features/gardens/GardenPage'
import { CyclePage } from '../src/features/cycles/CyclePage'
import { PhotoGalleryPage } from '../src/features/cycles/PhotoGalleryPage'
import { MaintenancePage } from '../src/features/gardens/MaintenancePage'
import { GardensPage } from '../src/features/gardens/GardensPage'
import { TodayPage } from '../src/features/gardens/TodayPage'
import { ControlPage } from '../src/features/gardens/ControlPage'
import '../src/styles.css'
import '../src/visual-pass-a.css'
import '../src/visual-pass-b.css'

// QA-only presentation switches. Never imported by the production entry point.
const options = new URLSearchParams(location.search)
const frame = options.get('frame')
if (options.has('fallback')) Object.defineProperty(document, 'startViewTransition', { value: undefined })
if (options.has('reduced')) {
  const original = window.matchMedia.bind(window)
  window.matchMedia = (query) => query === '(prefers-reduced-motion: reduce)' ? Object.assign(original(query), { matches: true }) : original(query)
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after {animation:none!important;transition:none!important}'
  document.head.append(style)
}
if (frame !== null && document.startViewTransition) {
  const original = document.startViewTransition.bind(document)
  document.startViewTransition = ((callback: ViewTransitionUpdateCallback) => {
    const transition = original(callback)
    void transition.ready.then(() => {
      if (options.get('direction') === 'back' && !location.hash.startsWith('#/garden/')) return
      document.getAnimations().forEach((animation) => { animation.pause(); animation.currentTime = Number(frame) })
      document.documentElement.dataset.qaMotion = `paused-${frame}`
    }).catch(() => { document.documentElement.dataset.qaMotion = 'snapshot-unavailable' })
    return transition
  }) as typeof document.startViewTransition
}
if (frame !== null && !document.startViewTransition) {
  const original = Element.prototype.animate
  Element.prototype.animate = function (...args) {
    const animation = original.apply(this, args)
    if (this.classList.contains('place-flight')) {
      animation.pause(); animation.currentTime = Number(frame)
      document.documentElement.dataset.qaMotion = `fallback-paused-${frame}`
    }
    return animation
  }
}
sessionStorage.setItem('streex-garden-entry-seen', '1')
if (!location.hash) location.hash = '/'
const qaUser = { id: 'qa-user', email: 'demo@example.invalid' } as never
createRoot(document.getElementById('root')!).render(<><aside style={{ padding: '6px 12px', background: '#193b2a', color: 'white', fontSize: 11 }}>QA LOCAL · Datos simulados · Fotografía de prueba · No escribe en Supabase</aside><HashRouter><Routes><Route path="/" element={<GardensPage user={qaUser} />} /><Route path="/garden/:gardenId" element={<GardenPage />} /><Route path="/cycle/:cycleId" element={<CyclePage />} /><Route path="/cycle/:cycleId/photos" element={<PhotoGalleryPage />} /><Route path="/today" element={<TodayPage />} /><Route path="/control" element={<ControlPage />} /><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /></Routes></HashRouter></>)
