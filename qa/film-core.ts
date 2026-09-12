import '../src/components/botanical/botanical.css'
import { buildFilmCatalogue, composeGrowthFilm, FILM_TRACKS, type FilmTrackId } from '../src/features/cycles/growth-film-composition'
import { FilmRenderSession, enterFilmFullscreen } from '../src/features/cycles/growth-film-session'
import { downloadFilmArtifact } from '../src/features/cycles/growth-film-export'
import type { GrowCycleDetail } from '../src/domain/types'

// Synthetic, visibly labelled QA frames. No private photographs or remote Garden data.
const images = ['#476345', '#88724b'].map((color, i) => URL.createObjectURL(new Blob([
  `<svg xmlns="http://www.w3.org/2000/svg" width="${i ? 1200 : 700}" height="${i ? 700 : 1200}"><rect width="100%" height="100%" fill="${color}" stroke="#e9eedb" stroke-width="28"/><circle cx="50%" cy="40%" r="160" fill="#b4c6a0"/><text x="50%" y="40%" text-anchor="middle" font-size="70">QA ${i + 1}</text><text x="50%" y="65%" text-anchor="middle" font-size="28">FOTOGRAFÍA DE PRUEBA</text></svg>`,
], { type: 'image/svg+xml' })))
const fixture: GrowCycleDetail = {
  id: 'qa-cycle', garden: { id: 'qa-garden', name: 'Jardín de prueba' }, position: { id: 'qa-position', position_number: 1 }, crop_name: 'Planta de prueba', state: 'active', revision: 1,
  planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet', corrections: [],
  history: images.map((_, i) => ({ id: `event-${i}`, event_type: i ? 'intervention' : 'observation', occurred_at: `2026-09-0${i + 1}T12:00:00Z`, note: i ? 'Una nota confirmada acompaña la fotografía.' : 'Un momento de su diario.', event_data: i ? { class: 'thinning' } : {}, revision: 1, photo: { id: `photo-${i}`, captured_at: `2026-09-0${i + 1}T12:00:00Z`, captured_at_precision: 'exact', upload_status: 'uploaded', storage_path: String(i), original_filename: 'qa.svg', content_type: 'image/jpeg', byte_size: 0, checksum_sha256: null } })),
}
const catalogue = buildFilmCatalogue({ kind: 'cycle', id: fixture.id, title: fixture.crop_name }, [fixture])
const root = document.querySelector<HTMLElement>('#root')!
root.className = 'botanical-surface'
root.style.cssText = 'min-height:100vh;padding:24px;max-width:960px;margin:auto'
root.innerHTML = `<h1>Prueba del motor de Growth Film</h1><p>Fixtures sintéticas. Esta pantalla no es la interfaz del producto.</p><form style="display:flex;gap:12px;flex-wrap:wrap;margin:24px 0"><label>Música <select id="music"><option value="">Sin música</option></select></label><label>Volumen <input id="volume" aria-label="Volumen" type="range" min="0" max="100" value="30"></label><label><input id="titles" type="checkbox" checked> Títulos</label><label><input id="reduced" type="checkbox"> Movimiento reducido</label><button id="prepare" type="submit">Preparar video</button><button id="cancel" type="button">Cancelar</button></form><p role="status" id="status">Sin preparar</p><video id="preview" controls playsinline preload="auto" style="display:block;max-height:70vh;width:100%;background:#0b130e;object-fit:contain" aria-label="Vista previa del archivo final"></video><p><button id="fullscreen" disabled>Pantalla completa nativa</button> <button id="download" disabled>Descargar el mismo video</button></p><output id="proof"></output>`
const select = root.querySelector<HTMLSelectElement>('#music')!
FILM_TRACKS.forEach(track => select.add(new Option(track.name, track.id)))
const video = root.querySelector<HTMLVideoElement>('video')!
const status = root.querySelector<HTMLElement>('#status')!
const proof = root.querySelector<HTMLOutputElement>('#proof')!
const download = root.querySelector<HTMLButtonElement>('#download')!
const fullscreen = root.querySelector<HTMLButtonElement>('#fullscreen')!
const session = new FilmRenderSession()
const makePlan = () => composeGrowthFilm(catalogue, { selectedIds: catalogue.moments.map(moment => moment.id), trackId: (select.value || null) as FilmTrackId | null, volume: Number(root.querySelector<HTMLInputElement>('#volume')!.value) / 100, titles: root.querySelector<HTMLInputElement>('#titles')!.checked, reducedMotion: root.querySelector<HTMLInputElement>('#reduced')!.checked })
root.querySelector('form')!.onsubmit = event => { event.preventDefault(); void session.prepare(makePlan(), async moment => images[Number(moment.storagePath)]) }
root.querySelector<HTMLButtonElement>('#cancel')!.onclick = session.clear
root.querySelector('form')!.onchange = session.clear
session.subscribe(() => {
  const state = session.getSnapshot()
  download.disabled = state.status !== 'ready'
  fullscreen.disabled = true
  if (state.status === 'ready') {
    video.src = state.artifact.url
    status.textContent = 'Video listo: la vista previa y la descarga usan el mismo archivo.'
    proof.textContent = `${state.artifact.mimeType} · ${state.artifact.blob.size} bytes · ${state.artifact.durationMs} ms previstos`
  } else {
    video.pause(); video.removeAttribute('src'); video.load()
    proof.textContent = ''
    status.textContent = state.status === 'error' ? state.message : state.status === 'preparing' ? `${state.progress?.phase ?? 'preparing'} ${state.progress?.completed ?? 0}/${state.progress?.total ?? 2}` : 'Sin preparar'
  }
})
video.onloadeddata = () => { fullscreen.disabled = false }
video.onloadedmetadata = () => { proof.textContent += ` · ${video.videoWidth}×${video.videoHeight}` }
fullscreen.onclick = () => { void enterFilmFullscreen(video).catch(reason => { status.textContent = String(reason) }) }
download.onclick = () => { const result = session.artifactFor(makePlan().key); if (result) downloadFilmArtifact(result, `garden-x-core-${select.value || 'silent'}`) }
window.addEventListener('pagehide', () => { session.clear(); images.forEach(url => URL.revokeObjectURL(url)) }, { once: true })
