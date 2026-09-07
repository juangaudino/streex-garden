import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail, GardenSummary, ImportCandidate } from '../../domain/types'
import { createImportBatch, getGarden, getHome, getImportCandidates, reviewImportCandidate, updateImportCandidate } from '../../lib/garden-api'
import { sha256Hex } from '../../domain/photo-integrity'

function dateLabel(value: string | null, precision: ImportCandidate['occurred_on_precision']) {
  if (!value || precision === 'unknown') return 'Fecha del hecho: desconocida'
  return `Fecha del hecho: ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))}`
}

export function ImportPage() {
  const [gardens, setGardens] = useState<GardenSummary[]>([])
  const [selectedGardenId, setSelectedGardenId] = useState('')
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null)
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<'observation' | 'recommendation' | 'conflict'>('observation')
  const [editingCandidate, setEditingCandidate] = useState<ImportCandidate | null>(null)
  const [completionGardenId, setCompletionGardenId] = useState('')
  const [completionGarden, setCompletionGarden] = useState<GardenDetail | null>(null)
  const [completionCycleId, setCompletionCycleId] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextGardens, nextCandidates] = await Promise.all([getHome(), getImportCandidates()])
      setGardens(nextGardens)
      setCandidates(nextCandidates)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Importación.') }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the remote review queue is loaded after mount.
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!selectedGardenId) return
    void getGarden(selectedGardenId).then((next) => { setGarden(next); setCycleId('') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar los ciclos.'))
  }, [selectedGardenId])
  useEffect(() => {
    if (!completionGardenId) return
    void getGarden(completionGardenId).then((next) => { setCompletionGarden(next); setCompletionCycleId('') }).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar los ciclos.'))
  }, [completionGardenId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!source.trim() || !note.trim()) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const candidate = { candidate_key: 'manual-1', candidate_type: type, grow_cycle_id: cycleId || null, occurred_on: date || null, occurred_on_precision: date ? 'exact' as const : 'unknown' as const, note: note.trim(), source_data: { entered_manually: true } }
      const fingerprint = await sha256Hex(new TextEncoder().encode(JSON.stringify({ source: source.trim(), candidate })).buffer)
      const result = await createImportBatch({ requestId: crypto.randomUUID(), sourceLabel: source.trim(), sourceFingerprint: fingerprint, candidates: [candidate] })
      setMessage(result.created ? 'Candidato guardado para tu revisión. Aún no es un hecho.' : 'Ese mismo candidato ya estaba en revisión; no se duplicó.')
      setSource(''); setNote(''); setCycleId(''); setDate(''); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el candidato.') } finally { setBusy(false) }
  }

  const decide = async (candidate: ImportCandidate, decision: 'confirmed' | 'rejected') => {
    setBusy(true); setError(null)
    try {
      await reviewImportCandidate({ requestId: crypto.randomUUID(), candidateId: candidate.id, decision })
      setMessage(decision === 'confirmed' ? 'Importación confirmada como observación.' : 'Candidato rechazado. No se creó ningún hecho.')
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar la decisión.') } finally { setBusy(false) }
  }

  const beginCompletion = (candidate: ImportCandidate) => {
    setEditingCandidate(candidate); setCompletionGardenId(''); setCompletionGarden(null)
    setCompletionCycleId(candidate.grow_cycle_id ?? ''); setCompletionDate(candidate.occurred_on ?? ''); setError(null)
  }
  const saveCompletion = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingCandidate || !completionCycleId || !completionDate) return
    setBusy(true); setError(null)
    try {
      await updateImportCandidate({ requestId: crypto.randomUUID(), candidateId: editingCandidate.id, growCycleId: completionCycleId, occurredOn: completionDate })
      setEditingCandidate(null)
      setMessage('Datos completados. El candidato sigue en revisión hasta que confirmes la observación.')
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron completar los datos.') } finally { setBusy(false) }
  }

  return <AppShell title="Importar historia" subtitle="Revisión antes de crear hechos" backTo="/control">
    <section className="gallery-intro"><ShieldCheck size={22} aria-hidden="true" /><div><h2>Importación selectiva</h2><p>Una recomendación, contradicción o fecha desconocida se conserva como candidata. Nada se incorpora a tu historial sin una decisión explícita.</p></div></section>
    <form className="editor-card" onSubmit={(event) => void submit(event)}>
      <div className="section-heading"><h2>Nuevo candidato</h2><span>Revisión</span></div>
      <label>Fuente<input value={source} maxLength={180} onChange={(event) => setSource(event.target.value)} placeholder="Ej.: nota personal, conversación, libreta" required /></label>
      <label>Contenido<textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Describe el dato tal como consta en la fuente" required /></label>
      <label>Tipo<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="observation">Observación candidata</option><option value="recommendation">Recomendación (no es hecho)</option><option value="conflict">Contradicción (no aplicable)</option></select></label>
      <label>Jardín asociado<select value={selectedGardenId} onChange={(event) => { const nextId = event.target.value; setSelectedGardenId(nextId); setGarden(null); setCycleId('') }}><option value="">Sin jardín todavía</option>{gardens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Ciclo asociado <span className="field-optional">opcional para revisar; obligatorio al confirmar una observación</span><select value={cycleId} onChange={(event) => setCycleId(event.target.value)} disabled={!garden}><option value="">Sin ciclo todavía</option>{garden?.positions.filter((position) => position.current_cycle).map((position) => <option key={position.id} value={position.current_cycle!.id}>{position.current_cycle!.crop_name} · Posición {position.position_number}</option>)}</select></label>
      <label>Fecha del hecho <span className="field-optional">dejar vacía conserva “desconocida” y bloquea confirmación</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <button className="primary-button" type="submit" disabled={busy}><FileText size={17} aria-hidden="true" /> {busy ? 'Guardando…' : 'Guardar para revisión'}</button>
    </form>
    {message && <p className="inline-message" role="status">{message}</p>}
    {error && <StatePanel kind="error" title="Importación no disponible" onRetry={() => void load()}>{error}</StatePanel>}
    {!candidates && !error && <StatePanel kind="loading" title="Cargando candidatos" />}
    {candidates && <section className="history-section"><div className="section-heading"><h2>Importaciones</h2><span>{candidates.filter((candidate) => candidate.decision === 'pending').length} por revisar</span></div>
      {candidates.length === 0 && <StatePanel kind="empty" title="Aún no hay candidatos">Cuando aportes un dato histórico, quedará aquí para ser revisado antes de incorporarse.</StatePanel>}
      <div className="correction-list">{candidates.map((candidate) => {
        const canConfirm = candidate.candidate_type === 'observation' && candidate.grow_cycle_id && candidate.occurred_on_precision === 'exact'
        const isEditing = editingCandidate?.id === candidate.id
        return <article key={candidate.id}><strong>{candidate.decision === 'confirmed' ? 'Observación confirmada' : candidate.decision === 'rejected' ? 'Candidato rechazado' : candidate.candidate_type === 'observation' ? 'Observación candidata' : candidate.candidate_type === 'recommendation' ? 'Recomendación' : 'Contradicción'}</strong><p>{candidate.note}</p><time>{candidate.source_label} · {dateLabel(candidate.occurred_on, candidate.occurred_on_precision)}</time>
          {candidate.decision === 'pending' && <div className="button-row"><button className="secondary-button secondary-button--compact" type="button" disabled={busy} onClick={() => void decide(candidate, 'rejected')}>Rechazar</button>{canConfirm ? <button className="primary-button primary-button--compact" type="button" disabled={busy} onClick={() => void decide(candidate, 'confirmed')}>Confirmar como observación</button> : candidate.candidate_type === 'observation' ? <button className="primary-button primary-button--compact" type="button" disabled={busy} onClick={() => beginCompletion(candidate)}>Completar datos</button> : <small>Este tipo se conserva para revisión y no crea hechos.</small>}</div>}
          {isEditing && <form className="editor-card import-completion" onSubmit={(event) => void saveCompletion(event)}><div className="section-heading"><h3>Completar antes de confirmar</h3><button className="text-button" type="button" disabled={busy} onClick={() => setEditingCandidate(null)}>Cancelar</button></div><p>Esto sólo añade contexto al candidato. La observación seguirá sin crearse hasta que uses su confirmación explícita.</p><label>Jardín<select value={completionGardenId} onChange={(event) => { const nextId = event.target.value; setCompletionGardenId(nextId); setCompletionGarden(null); setCompletionCycleId('') }} required><option value="">Selecciona el jardín del ciclo</option>{gardens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Ciclo asociado<select value={completionCycleId} onChange={(event) => setCompletionCycleId(event.target.value)} disabled={!completionGarden} required><option value="">Selecciona el ciclo</option>{completionGarden?.positions.filter((position) => position.current_cycle).map((position) => <option key={position.id} value={position.current_cycle!.id}>{position.current_cycle!.crop_name} · Posición {position.position_number}</option>)}</select></label><label>Fecha exacta del hecho<input type="date" value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} required /></label><button className="primary-button primary-button--compact" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos de revisión'}</button></form>}
          {candidate.decision !== 'pending' && (candidate.decision === 'confirmed' && candidate.grow_cycle_id
            ? <Link className="text-link" to={`/cycle/${candidate.grow_cycle_id}`}>Abrir la observación confirmada</Link>
            : <small>Rechazada</small>)}
        </article>
      })}</div>
    </section>}
  </AppShell>
}
