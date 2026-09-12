import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Pause } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BotanicalButton, BotanicalSheet } from '../../components/botanical/BotanicalControls'
import { PwaUpdateNotice } from '../../components/PwaUpdateNotice'
import type { MaintenanceSession } from '../../domain/types'
import { getMaintenanceSession, markMaintenancePositionInspected, progressMaintenancePosition, setMaintenanceSessionState } from '../../lib/garden-api'
import { MaintenancePositionActions, type InspectionSource } from './MaintenancePositionActions'
import './maintenance-botanical.css'

export function MaintenancePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<MaintenanceSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'pause' | 'summary' | 'finish' | null>(null)
  const [feedback, setFeedback] = useState('')
  const requests = useRef(new Map<string, string>())
  const operationLock = useRef(false)
  const heading = useRef<HTMLElement>(null)
  const requestId = (key: string) => {
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID())
    return requests.current.get(key)!
  }
  const load = useCallback(async () => {
    if (!sessionId) return
    setError(null)
    try { setSession(await getMaintenanceSession(sessionId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir la revisión.') }
  }, [sessionId])
  useEffect(() => {
    let active = true
    if (sessionId) void getMaintenanceSession(sessionId).then(value => { if (active) setSession(value) }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo abrir la revisión.')
    })
    return () => { active = false }
  }, [sessionId])
  const current = session?.positions.find(position => position.progress === 'not_reviewed') ?? null
  const paused = session?.state === 'paused'
  const closed = session?.state === 'completed' || session?.state === 'abandoned'
  const matching = current?.captured_grow_cycle_id && current.captured_grow_cycle_id === current.current_grow_cycle_id
  const counts = {
    reviewed: session?.positions.filter(position => position.progress === 'reviewed').length ?? 0,
    healthy: session?.positions.filter(position => position.health_confirmed).length ?? 0,
    skipped: session?.positions.filter(position => position.progress === 'skipped').length ?? 0,
  }
  const progress = async (operation: 'healthy' | 'next' | 'skip', source: InspectionSource = 'manual') => {
    if (!current || !sessionId || paused || closed || operationLock.current) return
    operationLock.current = true; setBusy(true); setError(null)
    try {
      const id = requestId(`${current.id}:${operation}:${source}`)
      if (operation === 'healthy') {
        // Explicit agronomic conclusion: the RPC creates one visual_review event.
        await progressMaintenancePosition(id, current.id, 'reviewed')
      } else if (operation === 'skip' || source === 'structural') {
        await progressMaintenancePosition(id, current.id, 'skipped')
      } else {
        // Session progress only. This RPC never inserts a plant fact or healthy review.
        await markMaintenancePositionInspected(id, current.id, source)
      }
      setSession(await getMaintenanceSession(sessionId))
      setFeedback(operation === 'healthy' ? 'Observación «Se ve bien» guardada.' : operation === 'skip' ? 'Posición omitida.' : 'Siguiente posición.')
      window.scrollTo({ top: 0, behavior: 'instant' })
      heading.current?.focus({ preventScroll: true })
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error('No se pudo continuar. Reintenta para recuperar el progreso.')
    } finally { operationLock.current = false; setBusy(false) }
  }
  const changeSession = async (state: 'paused' | 'in_progress' | 'completed') => {
    if (!session || operationLock.current) return
    operationLock.current = true; setBusy(true); setError(null)
    try {
      const key = `${session.id}:${session.state}:${state}`
      await setMaintenanceSessionState(requestId(key), session.id, state)
      const updated = await getMaintenanceSession(session.id)
      setSession(updated); setDialog(null); requests.current.delete(key)
      if (state === 'completed') navigate(`/garden/${session.positions[0]?.garden_id ?? ''}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el estado del recorrido.') }
    finally { operationLock.current = false; setBusy(false) }
  }
  const summary = <><div className="bm-stats"><div><strong>{counts.reviewed}</strong><span>revisadas</span></div><div><strong>{counts.healthy}</strong><span>se ven bien</span></div><div><strong>{counts.skipped}</strong><span>omitidas</span></div></div><ol className="bm-rail" aria-label="Posiciones del recorrido">{session?.positions.map(position => <li key={position.id} aria-current={position.id === current?.id ? 'step' : undefined}><span>{String(position.position_number).padStart(2, '0')}</span><div><strong>{position.garden_name} · {position.crop_name ?? 'Posición vacía'}</strong><small>{position.progress === 'reviewed' ? position.health_confirmed ? 'Revisada · Se ve bien' : 'Revisada · sin conclusión de salud' : position.progress === 'skipped' ? 'Omitida' : position.id === current?.id ? 'Ahora' : 'Pendiente'}</small></div></li>)}</ol></>
  return <div className="botanical-surface botanical-maintenance">
    <header className="bm-context" ref={heading} tabIndex={-1}>
      <div className="bm-context-top"><button className="bs-icon-button" type="button" aria-label="Pausar revisión" disabled={busy || !session} onClick={() => closed ? navigate('/') : setDialog('pause')}><ArrowLeft size={21} /></button><div><span className="bs-eyebrow">{current ? `${current.garden_name} · POSICIÓN ${current.position_number}` : 'TU REVISIÓN'}</span><strong>{current?.crop_name ?? (current ? 'Posición vacía' : 'Recorrido del jardín')}</strong></div>{session && <button type="button" className="bm-count" aria-label="Ver progreso de la revisión" disabled={busy} onClick={() => setDialog('summary')}>{current?.ordinal ?? session.positions.length}<span> / {session.positions.length}</span></button>}</div>
      {session && <div className="bm-progress" aria-label={`Posición ${current?.ordinal ?? session.positions.length} de ${session.positions.length}`}>{session.positions.map(position => <span key={position.id} className={position.progress !== 'not_reviewed' ? 'is-complete' : position.id === current?.id ? 'is-current' : ''} />)}</div>}
    </header>
    <span className="sr-only" role="status">{feedback}</span>
    {error && <div className="bm-page-notice bs-notice bs-notice--error" role="alert"><div>{error}<button className="bs-text-button" onClick={() => void load()}>Reintentar</button></div></div>}
    {!session && !error && <main className="bm-loading"><p role="status">Abriendo tu recorrido…</p></main>}
    {session && <>
      {paused && <main className="bm-finished"><Pause size={32} /><h1>La revisión puede esperar.</h1><p>Tu progreso está guardado. Puedes retomar esta posición.</p><BotanicalButton disabled={busy} onClick={() => void changeSession('in_progress')}>Retomar revisión <ArrowRight size={18} /></BotanicalButton><Link className="bs-text-button" to="/">Volver a Home</Link></main>}
      {/* Keep the active editor mounted across a pause; navigation still blocks all writes. */}
      {current && !closed && <div className="bm-active" hidden={paused}>
        {matching ? <MaintenancePositionActions key={current.id} position={current} disabled={busy || paused} onInspectionRecorded={source => progress('next', source)} onConfirmHealthy={() => progress('healthy')} onSkip={() => progress('skip')} /> : <main className="bm-finished"><h1>{current.captured_grow_cycle_id ? 'Esta posición cambió.' : 'Un lugar para lo que viene.'}</h1><p>{current.captured_grow_cycle_id ? 'El ocupante actual es otro. Esta revisión no se aplicará a su ciclo.' : 'No hay una planta en esta posición. Puedes seguir con el recorrido.'}</p><BotanicalButton disabled={busy || paused} onClick={() => void progress('skip').catch(reason => setError(reason.message))}>Omitir posición <ArrowRight size={18} /></BotanicalButton></main>}
      </div>}
      {(!current || closed) && !paused && <main className="bm-finished"><span className="bm-completion-mark"><Check size={32} /></span><span className="bs-eyebrow">TU RECORRIDO</span><h1>Un momento de cuidado.<br /><em>Todo queda en su lugar.</em></h1><p>{closed ? 'Esta sesión está cerrada. Sus registros se conservan.' : 'Terminaste las posiciones de esta revisión.'}</p><div>{summary}</div>{closed ? <Link className="bs-text-button" to="/">Volver a Home <ArrowRight size={18} /></Link> : <BotanicalButton disabled={busy} onClick={() => void changeSession('completed')}>Finalizar revisión <Check size={17} /></BotanicalButton>}</main>}
    </>}
    {dialog && session && <BotanicalSheet title={dialog === 'pause' ? '¿Hacemos una pausa?' : dialog === 'finish' ? '¿Terminar aquí?' : 'Tu recorrido'} onClose={() => setDialog(null)} busy={busy}>
      {dialog === 'pause' && <><p className="bs-sheet-copy">El progreso queda guardado en tu cuenta. Puedes retomar esta posición cuando quieras.</p><div className="bs-sheet-footer"><BotanicalButton secondary disabled={busy} onClick={() => setDialog(null)}>Seguir revisando</BotanicalButton><BotanicalButton disabled={busy} onClick={() => void changeSession('paused')}><Pause size={17} />Pausar</BotanicalButton></div></>}
      {dialog === 'summary' && <><div className="bs-sheet-body">{summary}</div><div className="bs-sheet-footer"><BotanicalButton secondary onClick={() => setDialog(null)}>Volver</BotanicalButton>{!closed && <BotanicalButton onClick={() => setDialog('finish')}>Finalizar sesión</BotanicalButton>}</div></>}
      {dialog === 'finish' && <><p className="bs-sheet-copy">Quedan {session.positions.filter(position => position.progress === 'not_reviewed').length} posiciones pendientes. Se conservarán tus registros; terminar no confirmará el estado de esas plantas.</p><div className="bs-sheet-footer"><BotanicalButton secondary disabled={busy} onClick={() => setDialog(null)}>Seguir revisando</BotanicalButton><BotanicalButton disabled={busy} onClick={() => void changeSession('completed')}>Finalizar</BotanicalButton></div></>}
      {error && <p className="bs-notice bs-notice--error" role="alert">{error}</p>}
    </BotanicalSheet>}
    <PwaUpdateNotice />
  </div>
}
