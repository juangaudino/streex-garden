import type { FilmComposition } from './growth-film-composition'
import { renderGrowthFilm, type FilmArtifact, type FilmExportProgress, type FilmPhotoResolver } from './growth-film-export'

export type FilmSessionState =
  | { status: 'idle' }
  | { status: 'preparing'; compositionKey: string; progress: FilmExportProgress | null }
  | { status: 'ready'; compositionKey: string; artifact: FilmArtifact }
  | { status: 'error'; compositionKey: string; message: string }

/** One editor owns one session. No background render or blob can outlive its selection. */
export class FilmRenderSession {
  private state: FilmSessionState = { status: 'idle' }
  private listeners = new Set<() => void>()
  private generation = 0
  private abort: AbortController | null = null
  constructor(private readonly renderer: typeof renderGrowthFilm = renderGrowthFilm) {}

  getSnapshot = (): FilmSessionState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(state: FilmSessionState) { this.state = state; this.listeners.forEach(listener => listener()) }

  /** Invoke synchronously on every change to moments, titles, track, volume or motion. */
  clear = () => {
    this.generation += 1
    this.abort?.abort(); this.abort = null
    if (this.state.status === 'ready') this.state.artifact.dispose()
    this.publish({ status: 'idle' })
  }

  /** Invoke directly in the prepare-button handler to preserve Safari's audio gesture. */
  prepare = async (plan: FilmComposition, resolvePhotoUrl: FilmPhotoResolver): Promise<void> => {
    if ((this.state.status === 'preparing' || this.state.status === 'ready') && this.state.compositionKey === plan.key) return
    this.clear()
    const generation = this.generation
    const controller = new AbortController()
    this.abort = controller
    this.publish({ status: 'preparing', compositionKey: plan.key, progress: null })
    try {
      const artifact = await this.renderer(plan, { resolvePhotoUrl, signal: controller.signal, onProgress: progress => {
        if (generation === this.generation) this.publish({ status: 'preparing', compositionKey: plan.key, progress })
      } })
      if (generation !== this.generation) { artifact.dispose(); return }
      if (artifact.compositionKey !== plan.key) { artifact.dispose(); throw new Error('El video no corresponde a la selección actual.') }
      this.publish({ status: 'ready', compositionKey: plan.key, artifact })
    } catch (reason) {
      if (generation !== this.generation) return
      this.publish({ status: 'error', compositionKey: plan.key, message: reason instanceof Error ? reason.message : 'No se pudo preparar el video.' })
    } finally { if (generation === this.generation) this.abort = null }
  }

  /** A stale ready state cannot be used for download after an editor option changed. */
  artifactFor = (compositionKey: string): FilmArtifact | null => this.state.status === 'ready' && this.state.compositionKey === compositionKey ? this.state.artifact : null
}

type NativeFilmVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitSupportsFullscreen?: boolean
  webkitRequestFullscreen?: () => Promise<void> | void
}

/** No await before the native method: iPhone requires the original user gesture. */
export function enterFilmFullscreen(video: NativeFilmVideo): Promise<void> {
  if (video.readyState < 2) return Promise.reject(new Error('El video se está cargando. Pulsa pantalla completa cuando esté listo.'))
  try {
    if (video.webkitEnterFullscreen && video.webkitSupportsFullscreen !== false) {
      video.webkitEnterFullscreen()
      return Promise.resolve()
    }
    if (video.requestFullscreen) return video.requestFullscreen()
    if (video.webkitRequestFullscreen) return Promise.resolve(video.webkitRequestFullscreen())
    return Promise.reject(new Error('Este navegador no permite abrir el video en pantalla completa.'))
  } catch (reason) { return Promise.reject(reason) }
}
