import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GrowCycleDetail } from '../../domain/types'
import { buildCanonicalActions, type GardenAiCanonicalAction, type GardenAiCheckProposalV1 } from '../../domain/ai'
import { requestAiCheck } from '../../lib/ai-gateway'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { plantPhotos } from './plant-presentation'

export function AiCheckPanel({ cycle, photoId: initialPhotoId, comparePhotoId, onCanonicalAction, onContinue, title }: {
  cycle: GrowCycleDetail
  photoId?: string
  comparePhotoId?: string
  onCanonicalAction?: (action: GardenAiCanonicalAction) => void
  onContinue?: () => void
  title?: string
}) {
  const photos = useMemo(() => plantPhotos(cycle), [cycle])
  const [photoId, setPhotoId] = useState(initialPhotoId ?? photos[0]?.id ?? '')
  const [result, setResult] = useState<{ photoId: string; proposal: GardenAiCheckProposalV1 } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const version = useRef(0)
  const working = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const selectedPhotoId = photos.some(photo => photo.id === photoId) ? photoId : photos[0]?.id ?? ''
  const selected = photos.find(photo => photo.id === selectedPhotoId) ?? null
  const proposal = result?.photoId === selectedPhotoId ? result.proposal : null
  const analyze = async () => {
    if (!selectedPhotoId || working.current) return
    working.current = true
    const requestVersion = ++version.current
    setBusy(true); setMessage(null); setResult(null)
    try {
      const proposal = await requestAiCheck({ growCycleId: cycle.id, photoId: selectedPhotoId, comparePhotoId, requestKey: `${comparePhotoId ? 'ai-compare' : 'ai-check'}:${cycle.id}:${[selectedPhotoId, comparePhotoId].filter(Boolean).sort().join(':')}` })
      if (alive.current && version.current === requestVersion) setResult({ photoId: selectedPhotoId, proposal })
    } catch (reason) {
      if (alive.current && version.current === requestVersion) setMessage(reason instanceof Error ? reason.message : 'Garden AI no está disponible ahora.')
    } finally {
      if (alive.current && version.current === requestVersion) { working.current = false; setBusy(false) }
    }
  }
  const actions = proposal ? buildCanonicalActions(proposal, { growCycleId: cycle.id, gardenId: cycle.garden.id, positionId: cycle.position.id, evidenceRef: { kind: 'photo', id: selectedPhotoId } }) : []
  const runAction = (action: GardenAiCanonicalAction) => {
    if (onCanonicalAction) onCanonicalAction(action)
  }
  return <section className="ai-check-panel" aria-labelledby="ai-check-title"><div className="section-heading"><div><span className="eyebrow">Garden AI</span><h2 id="ai-check-title">{title ?? (comparePhotoId ? 'Analizar comparación' : 'Analizar esta planta')}</h2></div><Sparkles size={20} aria-hidden="true" /></div>{photos.length === 0 ? <p className="quiet-copy">Guarda una fotografía del ciclo para poder analizarla aquí.</p> : <><label>{comparePhotoId ? 'Fotografía actual' : 'Fotografía a analizar'}<select value={selectedPhotoId} onChange={(event) => { ++version.current; working.current = false; setBusy(false); setPhotoId(event.target.value); setResult(null); setMessage(null) }}>{photos.map(photo => <option key={photo.id} value={photo.id}>{photo.original_filename}</option>)}</select></label>{selected && <DocumentaryPhoto photo={selected} caption={false} rendition="thumbnail" />}{comparePhotoId && <p className="quiet-copy">Comparada con: {photos.find(photo => photo.id === comparePhotoId)?.original_filename ?? 'fotografía seleccionada'}</p>}{busy && <div className="ai-check-loading" role="status" aria-live="polite"><span className="ai-check-loading__mark"><Sparkles size={18} aria-hidden="true" /></span><span>Analizando tu planta…</span></div>}<button className="primary-button" type="button" disabled={busy} onClick={() => void analyze()}><Sparkles size={16} aria-hidden="true" />{busy ? 'Analizando tu planta…' : comparePhotoId ? 'Analizar comparación' : 'Analizar con Garden AI'}</button>{message && <p className="inline-message inline-message--error" role="alert">{message}</p>}{proposal && <div className="ai-check-result"><p className="ai-check-result__context">{cycle.garden.name} · Pod {cycle.position.position_number} · {cycle.crop_name}</p><h3>{proposal.summary}</h3>{proposal.observations.slice(0, 3).map((observation) => <p key={observation}>{observation}</p>)}{proposal.uncertainty.length > 0 && <details><summary>¿Por qué?</summary>{proposal.uncertainty.slice(0, 3).map((item) => <p key={item}>{item}</p>)}</details>}{actions.slice(0, 1).map((action) => { const purpose = action.label.toLowerCase().includes('poda') ? 'evaluate_pruning' : action.label.toLowerCase().includes('soporte') ? 'evaluate_support' : 'evaluate_thinning'; return onCanonicalAction ? <button className="secondary-button" key={action.kind} type="button" onClick={() => runAction(action)}><Check size={15} aria-hidden="true" />{action.label}</button> : <Link className="secondary-button" key={action.kind} to={{ pathname: `/cycle/${cycle.id}`, hash: action.kind === 'create_follow_up' ? '#cycle-attention' : '#cycle-fact' }} state={{ aiAction: action.kind === 'create_follow_up' ? purpose : undefined }}><Check size={15} aria-hidden="true" />{action.label}</Link> })}{onContinue && <button className="secondary-button" type="button" onClick={onContinue}>Continuar</button>}</div>}</>}</section>
}
