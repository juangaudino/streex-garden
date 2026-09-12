import { useEffect, useRef, useState } from 'react'
import type { FilmMoment } from './growth-film-composition'
import { resolveFilmPhoto } from './growth-film-photo'

/** Thumbnails request private evidence only when near the visible scroll area. */
export function GrowthFilmPhoto({ moment, alt = '', className = '' }: { moment: FilmMoment; alt?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let started = false
    const load = () => {
      if (started) return
      started = true
      void resolveFilmPhoto(moment, controller.signal).then(value => {
        if (!controller.signal.aborted) { setUrl(value); setFailed(false) }
      }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { load(); observer?.disconnect() }
    }, { rootMargin: '200px' })
    if (observer) observer.observe(ref.current!)
    else load()
    return () => { controller.abort(); observer?.disconnect() }
  }, [moment, attempt])
  return <span ref={ref} className={`film-photo ${className}`}>
    {url && !failed ? <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => {
      // Renew an expired URL once. A persistent failure stays visible, not an empty flash.
      if (attempt === 0) { setUrl(null); setAttempt(1) } else setFailed(true)
    }} /> : <span className="film-photo-placeholder">{failed ? 'Foto no disponible' : 'Cargando fotografía…'}</span>}
  </span>
}
