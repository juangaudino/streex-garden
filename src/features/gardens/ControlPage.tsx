import { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { ControlGarden, ControlPosition, ControlProjection, HarvestReadiness } from '../../domain/types'
import { seedCountLabel } from '../../domain/precision-semantics'
import { eventLabel } from '../../domain/event-presentation'
import { exportOwnerData, getControlV2 } from '../../lib/garden-api'
import { downloadControlCsv, downloadOwnerExport } from '../../lib/export-download'

const stateLabel = { reassuring: 'Desarrollo estable', watch: 'Vigilar', action_required: 'Requiere atención', insufficient_evidence: 'Sin evaluación suficiente' }
const readinessLabel: Record<HarvestReadiness, string> = { not_yet: 'Todavía no', evaluate: 'Evaluar preparación', ready: 'Lista para cosecha', not_applicable: 'No aplica' }
const nextLabel = { pending: 'Pendiente', evaluate_today: 'Evaluar hoy', scheduled: 'Programada', evaluate: 'Evaluar', not_required: 'No requiere', not_scheduled: 'Sin programar' }
const summaryLabel = { todo_bien: 'Todo bien', pendiente_vigilar: 'Pendiente / Vigilar', requiere_atencion: 'Requiere atención', sin_evaluacion_suficiente: 'Sin evaluación suficiente' }

function date(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '—'
}
function evidenceDate(position: ControlPosition): string {
  const evidence = position.current_state?.evidence ?? position.harvest_readiness?.evidence
  return evidence?.occurred_on ? `Evidencia: ${date(evidence.occurred_on)}` : 'Sin evidencia fechada'
}

function PositionControl({ row }: { row: ControlPosition }) {
  const cycleLink = row.grow_cycle_id ? `/cycle/${row.grow_cycle_id}` : null
  const content = <>
    <header className="control-position__heading"><span className="control-table__number" aria-hidden="true">{String(row.position.number).padStart(2, '0')}</span><div><strong>Posición {row.position.number}</strong><span>{row.plant?.name ?? 'Sin ciclo activo'}</span></div>{cycleLink && <Link className="icon-button control-position__open" to={cycleLink} aria-label={`Abrir ciclo de la posición ${row.position.number}`}><ExternalLink size={16} aria-hidden="true" /></Link>}</header>
    {row.grow_cycle_id && <div className="control-position__facts">
      <div><small>Siembra</small><b>{date(row.planting?.date)}{row.planting?.precision === 'approximate' ? ' · aprox.' : row.planting?.precision === 'unknown' ? ' · desconocida' : ''}</b></div>
      <div><small>Edad</small><b>{row.age.status === 'known' ? `${row.age.days} días` : '—'}</b></div>
      <div><small>Último aclareo</small><b>{row.last_thinning ? date(row.last_thinning.occurred_on) : 'Sin registro'}</b></div>
      <div><small>Próximo aclareo</small><b>{nextLabel[row.next_thinning_evaluation.kind]}{row.next_thinning_evaluation.task?.due_on ? ` · ${date(row.next_thinning_evaluation.task.due_on)}` : ''}</b></div>
      <div><small>Cosecha</small><b>{row.harvest_readiness ? readinessLabel[row.harvest_readiness.value] : '—'}</b></div>
      <div><small>Germinación</small><b>{row.germination?.status === 'confirmed' ? (row.germination.evidence?.confirmed_by ? `Confirmada hasta ${date(String(row.germination.evidence.confirmed_by))}` : 'Confirmada') : 'Sin observación'}</b></div>
      <div><small>Semillas</small><b>{seedCountLabel(row.seed_count)}</b></div>
      <div><small>Conteo</small><b>{row.plant_count && row.plant_count.count !== undefined && row.plant_count.count !== null ? `${row.plant_count.count} ${row.plant_count.count_kind === 'plants_kept' ? 'conservadas' : 'visibles'}` : 'Sin observación'}</b></div>
    </div>}
    {row.grow_cycle_id && <footer className="control-position__status"><span className={`control-state control-state--${row.current_state?.kind ?? 'insufficient_evidence'}`}>{stateLabel[row.current_state?.kind ?? 'insufficient_evidence']}</span><small>{evidenceDate(row)}</small>{row.action && <Link className="text-link" to={cycleLink ?? '/today'}>{row.action.title} <ExternalLink size={14} aria-hidden="true" /></Link>}</footer>}
  </>
  return <article className="control-position">{content}{cycleLink && <Link className="text-link" to={cycleLink}>Abrir ciclo <ExternalLink size={14} aria-hidden="true" /></Link>}</article>
}

function GardenControl({ garden }: { garden: ControlGarden }) {
  const categories = (Object.keys(summaryLabel) as Array<keyof typeof summaryLabel>).filter((key) => garden.summary[key])
  return <section className="control-garden"><div className="section-heading"><div><h2>{garden.garden_name}</h2><p>Germinación confirmada: {garden.germination_coverage.confirmed_positions}/{garden.germination_coverage.occupied_positions} posiciones ocupadas</p></div><Link className="secondary-button secondary-button--compact" to={`/garden/${garden.garden_id}`}>Abrir jardín</Link></div>
    {categories.length > 0 && <div className="control-summary" aria-label={`Resumen de ${garden.garden_name}`}>{categories.map((key) => <div className={`control-summary__item control-summary__item--${key}`} key={key}><strong>{summaryLabel[key]}</strong><span>{garden.summary[key]?.count} · posiciones {garden.summary[key]?.positions.join(', ')}</span></div>)}</div>}
    {garden.shared_actions.length > 0 && <div className="control-shared-actions"><strong>Acciones del sistema</strong>{garden.shared_actions.map((action) => <Link key={action.task_id} to="/today">{action.title}{action.due_on ? ` · ${date(action.due_on)}` : ''}</Link>)}</div>}
    <div className="control-positions">{garden.positions.map((position) => <PositionControl key={position.position.id} row={position} />)}</div>
    {garden.relevant_facts.length > 0 && <div className="control-facts"><strong>Hechos recientes</strong>{garden.relevant_facts.map((fact) => <span key={fact.event_id}>{date(fact.occurred_on)} · {fact.note ?? eventLabel(fact)}</span>)}</div>}
  </section>
}

export function ControlPage() {
  const [projection, setProjection] = useState<ControlProjection | null>(null)
  const [referenceDate, setReferenceDate] = useState(() => new Intl.DateTimeFormat('en-CA').format(new Date()))
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const load = useCallback(async (dateValue = referenceDate) => { setError(null); try { setProjection(await getControlV2(dateValue)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo generar Control V2.') } }, [referenceDate])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loader writes after the RPC settles.
  useEffect(() => { void load() }, [load])
  const downloadData = async () => {
    setExporting(true); setExportMessage(null)
    try { downloadOwnerExport(await exportOwnerData()); setExportMessage('Datos descargados. El archivo incluye el manifiesto de originales, no enlaces ni credenciales.') }
    catch (reason) { setExportMessage(`No se pudo preparar la exportación: ${reason instanceof Error ? reason.message : 'Error desconocido.'}`) }
    finally { setExporting(false) }
  }
  return <AppShell title="Control" subtitle="Estado derivado de evidencia y pendientes confirmados" backTo="/">
    <section className="control-intro"><div><h2>Estado del jardín</h2><p>Sin IA. La fecha reconstruye los hechos válidos disponibles ahora; no atribuye acciones ni salud donde no existe evidencia.</p></div><label>Fecha de referencia<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} onBlur={() => void load()} /></label></section>
    {!projection && !error && <StatePanel kind="loading" title="Generando Control" />}
    {error && <StatePanel kind="error" title="No se pudo generar Control" onRetry={() => void load()}>{error}</StatePanel>}
    {projection && <><p className="quiet-copy">{projection.interpretation}</p><div className="control-export"><div><strong>Exportar tus datos</strong><p>Descarga el informe o tus registros estructurados. Una exportación no sustituye un backup.</p></div><div className="button-row"><button className="secondary-button secondary-button--compact" type="button" onClick={() => downloadControlCsv(projection)}><Download size={16} aria-hidden="true" /> CSV</button><button className="secondary-button secondary-button--compact" type="button" disabled={exporting} onClick={() => void downloadData()}><Download size={16} aria-hidden="true" /> {exporting ? 'Preparando…' : 'Datos JSON'}</button></div>{exportMessage && <p className="inline-message" role="status">{exportMessage}</p>}</div><div className="control-garden-list">{projection.gardens.map((garden) => <GardenControl key={garden.garden_id} garden={garden} />)}</div></>}
  </AppShell>
}
