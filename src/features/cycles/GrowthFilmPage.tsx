import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatePanel } from '../../components/StatePanel'
import { getCycle, getGarden } from '../../lib/garden-api'
import { loadFilmCatalogue } from './growth-film-loader'
import type { FilmCatalogue } from './growth-film-composition'
import { GrowthFilmStudio } from './GrowthFilmStudio'

export function GrowthFilmPage() {
  const { cycleId, gardenId } = useParams()
  const kind = cycleId ? 'cycle' : 'garden'
  const id = cycleId ?? gardenId
  if (!id) return <StatePanel kind="error" title="No se encontró esta película" />
  // Route changes unmount the entire private diary/editor and dispose their resources.
  return <FilmRoute key={`${kind}:${id}`} kind={kind} id={id} />
}

function FilmRoute({ kind, id }: { kind: 'cycle' | 'garden'; id: string }) {
  const [catalogue, setCatalogue] = useState<FilmCatalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const backTo = `/${kind}/${id}`
  useEffect(() => {
    const controller = new AbortController()
    void loadFilmCatalogue({ kind, id }, { getCycle, getGarden }, controller.signal).then(value => {
      if (!controller.signal.aborted) setCatalogue(value)
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo abrir Growth Film.')
    })
    return () => controller.abort()
  }, [kind, id, attempt])
  if (catalogue) return <GrowthFilmStudio catalogue={catalogue} backTo={backTo} />
  return <div className="botanical-surface film-page"><header className="film-header"><Link className="bs-text-button" to={backTo}><ArrowLeft size={18} aria-hidden="true" />Volver</Link><span className="film-wordmark">GROWTH FILM</span></header><StatePanel kind={error ? 'error' : 'loading'} title={error ? 'No pudimos abrir tu diario.' : 'Abriendo tu diario…'} onRetry={error ? () => { setError(null); setAttempt(old => old + 1) } : undefined}>{error}</StatePanel></div>
}
