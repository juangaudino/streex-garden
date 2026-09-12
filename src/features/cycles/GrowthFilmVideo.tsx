import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Maximize2 } from 'lucide-react'
import { BotanicalButton } from '../../components/botanical/BotanicalControls'
import type { FilmComposition } from './growth-film-composition'
import { FilmRenderSession, enterFilmFullscreen } from './growth-film-session'
import { resolveFilmPhoto } from './growth-film-photo'

/** Final preview is the actual export, with its mixed audio and baked-in narrative. */
export function GrowthFilmVideo({ plan, session, onDuration }: { plan: FilmComposition; session: FilmRenderSession; onDuration?: (url: string, durationMs: number) => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const artifact = session.artifactFor(plan.key)
  return <div className="film-video-preview">
    {artifact ? <NativeFilmVideo key={artifact.url} url={artifact.url} onRetry={session.clear} onDuration={onDuration} /> : <div className="film-render-placeholder">
      <p>{state.status === 'preparing' ? 'Preparando tu historia…' : 'Prepara el video para verlo tal como se descargará.'}</p>
      {state.status === 'preparing' ? <>
        <p role="status">{state.progress?.phase === 'rendering' ? 'Creando película' : 'Preparando fotografías'}{state.progress ? ` · ${state.progress.completed} de ${state.progress.total}` : ''}</p>
        <BotanicalButton secondary onClick={session.clear}>Cancelar preparación</BotanicalButton>
      </> : <BotanicalButton onClick={() => void session.prepare(plan, resolveFilmPhoto)}>Preparar video</BotanicalButton>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      <small>Se prepara en este dispositivo. Mantén la pantalla abierta durante el proceso.</small>
    </div>}
  </div>
}

function NativeFilmVideo({ url, onRetry, onDuration }: { url: string; onRetry: () => void; onDuration?: (url: string, durationMs: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const node = ref.current!
    const begin = () => setFullscreen(true)
    const end = () => setFullscreen(false)
    const sync = () => setFullscreen(document.fullscreenElement === node || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement === node)
    node.addEventListener('webkitbeginfullscreen', begin)
    node.addEventListener('webkitendfullscreen', end)
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      node.pause(); node.removeAttribute('src'); node.load()
      node.removeEventListener('webkitbeginfullscreen', begin)
      node.removeEventListener('webkitendfullscreen', end)
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])
  return <>
    <video ref={ref} src={url} controls playsInline preload="auto" aria-label="Vista previa del video final" onLoadedData={() => setReady(true)} onDurationChange={event => {
      const seconds = event.currentTarget.duration
      if (Number.isFinite(seconds) && seconds > 0) onDuration?.(url, seconds * 1000)
    }} onLoadedMetadata={event => {
      const seconds = event.currentTarget.duration
      if (Number.isFinite(seconds) && seconds > 0) onDuration?.(url, seconds * 1000)
    }} onError={() => { setReady(false); setError('Este navegador no pudo reproducir el video. Prueba a prepararlo otra vez.') }} />
    <BotanicalButton secondary disabled={!ready || fullscreen} onClick={() => {
      setError(null)
      // Native call happens in this tap, after loadeddata; never after rendering awaits.
      void enterFilmFullscreen(ref.current!).catch(reason => setError(reason instanceof Error ? reason.message : 'No se pudo abrir pantalla completa.'))
    }}><Maximize2 size={18} aria-hidden="true" />{fullscreen ? 'En pantalla completa' : 'Pantalla completa'}</BotanicalButton>
    {error && <div role="alert"><p>{error}</p>{!ready && <BotanicalButton secondary onClick={onRetry}>Preparar de nuevo</BotanicalButton>}</div>}
  </>
}
