import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { MaintenancePortrait } from './MaintenancePortrait'
import { MaintenancePositionActions } from './MaintenancePositionActions'
import { Check, Pause, SkipForward } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { MaintenanceSession } from '../../domain/types'
import { getMaintenanceSession, markMaintenancePositionInspected, progressMaintenancePosition, setMaintenanceSessionState } from '../../lib/garden-api'

export function MaintenancePage() {
  const { sessionId } = useParams(); const navigate = useNavigate()
  const [session, setSession] = useState<MaintenanceSession | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'reviewed' | 'skipped'; text: string } | null>(null)
  const load = useCallback(async () => { if (!sessionId) return; setError(null); try { setSession(await getMaintenanceSession(sessionId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir la sesión.') } }, [sessionId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loader writes after the RPC settles.
  useEffect(() => { void load() }, [load])
  const current = session?.positions.find((position) => position.progress === 'not_reviewed') ?? null
  const recordInspection = async (source: 'observation' | 'fact' | 'manual') => {
    if (!current) return
    setBusy(true)
    try {
      await markMaintenancePositionInspected(crypto.randomUUID(), current.id, source)
      const next = await getMaintenanceSession(sessionId!)
      setSession(next)
      setFeedback({ kind: 'reviewed', text: `${current.garden_name} · Posición ${current.position_number}: inspección guardada${source === 'manual' ? '' : ' desde el ciclo'}.` })
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error('No se pudo marcar la posición como inspeccionada.')
    } finally { setBusy(false) }
  }
  const change = async (progress: 'reviewed' | 'skipped') => { if (!current) return; setBusy(true); try { await progressMaintenancePosition(crypto.randomUUID(), current.id, progress);
    const next = await getMaintenanceSession(sessionId!)
    const update = () => flushSync(() => { setSession(next); setFeedback({ kind: progress, text: `${current.garden_name} · Posición ${current.position_number}: ${progress === 'reviewed' ? 'revisión guardada' : 'omitida, sin revisión'}.` }) })
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.dataset.maintenanceMotion = progress
      const motion = document.startViewTransition(update)
      void motion.finished.finally(() => { delete document.documentElement.dataset.maintenanceMotion }).catch(() => {})
      await motion.updateCallbackDone
    } else update() } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el progreso.') } finally { setBusy(false) } }
  const pause = async () => { if (!session) return; setBusy(true); try { await setMaintenanceSessionState(crypto.randomUUID(), session.id, session.state === 'paused' ? 'in_progress' : 'paused'); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la sesión.') } finally { setBusy(false) } }
  const finish = async () => { if (!session) return; setBusy(true); try { await setMaintenanceSessionState(crypto.randomUUID(), session.id, 'completed'); navigate(`/garden/${session.positions[0]?.garden_id ?? ''}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo finalizar la sesión.') } finally { setBusy(false) } }
  const inspected = session?.positions.filter((position) => position.progress === 'reviewed').length ?? 0; const healthy = session?.positions.filter((position) => position.progress === 'reviewed' && position.health_confirmed).length ?? 0; const skipped = session?.positions.filter((position) => position.progress === 'skipped').length ?? 0
  return <AppShell presentation="maintenance" title="Mantenimiento" subtitle={session ? `${inspected} inspeccionadas · ${healthy} saludables · ${skipped} omitidas` : 'Cargando sesión'} backTo="/">
    {!session && !error && <StatePanel kind="loading" title="Abriendo mantenimiento" />}{error && <StatePanel kind="error" title="No se pudo abrir mantenimiento" onRetry={() => void load()}>{error}</StatePanel>}
    {feedback && <p className={`maintenance-feedback maintenance-feedback--${feedback.kind}`} role="status">{feedback.kind === 'reviewed' ? <Check size={17} aria-hidden="true" /> : <SkipForward size={17} aria-hidden="true" />}{feedback.text}</p>}
    {session && <>{current && <section className="maintenance-current" key={current.id}><div className="maintenance-context"><strong>{current.garden_name} · Posición {current.position_number}</strong><span>{current.crop_name ?? 'Posición vacía'} · {current.ordinal}/{session.positions.length}</span></div><MaintenancePortrait key={`${current.id}:${current.current_grow_cycle_id}:${current.captured_grow_cycle_id}`} position={current} />{current.current_grow_cycle_id !== current.captured_grow_cycle_id && <p className="inline-message inline-message--error">Ocupante cambiado. Revisa el nuevo ciclo explícitamente; esta sesión no aplicará una revisión al sucesor.</p>}{!current.captured_grow_cycle_id && <p className="quiet-copy">La posición está vacía. Puedes omitirla; no se registrará una revisión saludable.</p>}{session.state === 'paused' && <p className="quiet-copy">Recorrido pausado. Reanúdalo para registrar acciones o avanzar.</p>}{current.current_grow_cycle_id === current.captured_grow_cycle_id && current.captured_grow_cycle_id && <MaintenancePositionActions position={current} disabled={busy || session.state === 'paused'} onInspectionRecorded={recordInspection} />}<div className="button-row"><button className="primary-button" disabled={busy || session.state === 'paused' || !current.captured_grow_cycle_id || current.current_grow_cycle_id !== current.captured_grow_cycle_id} type="button" onClick={() => void change('reviewed')}><Check size={18} aria-hidden="true" /> Se ve bien</button><button className="secondary-button" disabled={busy || session.state === 'paused'} type="button" onClick={() => void change('skipped')}><SkipForward size={18} aria-hidden="true" /> Omitir</button></div></section>}{!current && <StatePanel kind="empty" title="Recorrido completado">Todas las posiciones quedaron inspeccionadas u omitidas. Puedes finalizar con este resumen.</StatePanel>}<section className="maintenance-summary"><h2>Progreso</h2><p>{inspected} inspeccionadas · {healthy} saludables · {skipped} omitidas · {(session.positions.length - inspected - skipped)} pendientes</p><ol className="maintenance-rail" aria-label="Posiciones del recorrido">{session.positions.map((position) => <li aria-current={position.id === current?.id ? 'step' : undefined} className={`maintenance-rail__item maintenance-rail__item--${position.progress}`} key={position.id}><span>{String(position.position_number).padStart(2, '0')}</span><div><strong>{position.garden_name} · Posición {position.position_number}</strong><small>{position.progress === 'reviewed' ? position.health_confirmed ? 'Inspeccionada · Se ve bien' : 'Inspeccionada' : position.progress === 'skipped' ? 'Omitida' : position.id === current?.id ? 'Ahora' : 'Pendiente'}</small></div></li>)}</ol><div className="button-row"><button className="secondary-button" type="button" disabled={busy || session.state === 'completed'} onClick={() => void pause()}><Pause size={17} aria-hidden="true" />{session.state === 'paused' ? 'Reanudar' : 'Pausar'}</button><button className="primary-button" type="button" disabled={busy || session.state === 'completed'} onClick={() => void finish()}>Finalizar sesión</button></div></section><Link className="text-link" to="/control">Abrir Control V2</Link></>}
  </AppShell>
}
