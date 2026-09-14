import { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, CalendarDays, ChevronRight, Film, Leaf, MoreHorizontal, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PlaceBackLink } from '../../components/PlaceLink'
import type { CycleHistoryEvent, GrowCycleDetail } from '../../domain/types'
import { harvestReadinessLabel } from '../../domain/invariants'
import { BotanicalButton } from '../../components/botanical/BotanicalControls'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { PhotoCoverActions } from './PhotoCoverActions'
import { recordLabel } from './photo-presentation'
import { plantPresentation } from './plant-presentation'
import { PlantHistory } from './PlantHistory'
import type { PlantSheetIntent } from './plant-intents'
import './plant-botanical.css'

export function PlantStudio({ cycle, onOpen, onCoverChanged, onMessage }: {
  cycle: GrowCycleDetail; onOpen: (intent: PlantSheetIntent) => void; onCoverChanged: () => Promise<void>; onMessage: (message: string) => void
}) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview')
  const section = useRef<HTMLElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const id = useId()
  const { name, portrait, photos, planting, observation } = plantPresentation(cycle)
  const openEvent = (event: CycleHistoryEvent) => onOpen({ kind: 'event', event })
  const history = () => {
    setTab('history')
    section.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    tabs.current[1]?.focus({ preventScroll: true })
  }
  return <div className="plant-page botanical-surface content-shell">
    <div className="page-utility"><PlaceBackLink className="breadcrumb" to={`/garden/${cycle.garden.id}`}>{cycle.garden.name}<ChevronRight size={13} />Posición {cycle.position.position_number}</PlaceBackLink><button className="bs-icon-button" type="button" aria-label="Opciones de la planta" onClick={() => onOpen({ kind: 'options' })}><MoreHorizontal size={21} /></button></div>
    <section className="plant-portrait" aria-label="Perfil del cultivo">
      <div className="portrait-image">{portrait ? <DocumentaryPhoto photo={portrait} eager expandable rendition="portrait" actions={<PhotoCoverActions gardenId={cycle.garden.id} cycleId={cycle.id} photoId={portrait.id} onMessage={onMessage} onChanged={onCoverChanged} />} /> : <div className="photo-placeholder"><Leaf size={34} /><span>Todavía sin fotografía documental</span></div>}<div className="portrait-position" data-place-id={cycle.position.id} data-place-origin="profile" data-place-cycle-id={cycle.id}><span>POSICIÓN</span><strong>{String(cycle.position.position_number).padStart(2, '0')}</strong></div><div className="portrait-reference">UNA MIRADA MÁS CERCA</div></div>
      <div className="plant-identity"><div className="bs-eyebrow"><span className="status-dot" />{cycle.state === 'active' ? 'CICLO ACTIVO' : 'CICLO CERRADO'}</div><h1 tabIndex={-1}>{name.common}</h1><p className="botanical-name">{name.subtitle}</p><p className="plant-lede">Cada hoja, parte de su historia.</p><div className="plant-facts"><div><strong>{planting.value}<span>{planting.unit}</span></strong><small>{planting.label}</small></div><div><strong>{photos.length}<span>fotografías</span></strong><small>disponibles en su diario</small></div></div>{cycle.state === 'active' && <BotanicalButton onClick={() => onOpen({ kind: 'choose' })}><Plus size={19} />Registrar un momento</BotanicalButton>}<button className="portrait-history-link" type="button" onClick={history}>Recorrer su historia<ArrowDown size={16} /></button></div>
    </section>
    <section ref={section} className="plant-sections">
      <div className="section-tabs" role="tablist" aria-label="Información de la planta" onKeyDown={event => {
        const current = tab === 'overview' ? 0 : 1
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - current : null
        if (next === null) return
        event.preventDefault(); setTab(next === 0 ? 'overview' : 'history'); tabs.current[next]?.focus()
      }}>{(['overview', 'history'] as const).map((value, index) => <button ref={node => { tabs.current[index] = node }} type="button" key={value} id={`${id}-${value}`} role="tab" tabIndex={tab === value ? 0 : -1} aria-controls={`${id}-panel`} aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'overview' ? 'Su presente' : <>Su historia<span>{cycle.history.length}</span></>}</button>)}</div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === 'overview' ? <div className="plant-overview">
          <div className="plant-current"><div className="section-kicker"><Leaf size={17} /><span>LO ÚLTIMO QUE OBSERVASTE</span></div><h2>{observation?.note || (observation ? 'Una fotografía, conservada en su historia.' : 'Aún no hay una observación registrada.')}</h2><p>{observation ? recordLabel(observation) : 'Una foto o una nota puede comenzar este diario.'}</p>{observation && <button className="bs-text-button" type="button" onClick={() => openEvent(observation)}>Ver el registro<ArrowRight size={16} /></button>}<div className="care-status"><span className="care-status-icon"><CalendarDays size={18} /></span><div><small>PREPARACIÓN PARA COSECHA</small><strong>{harvestReadinessLabel[cycle.harvest_readiness]}</strong></div><button className="bs-text-button" type="button" onClick={() => onOpen({ kind: 'review' })}>Revisar<ChevronRight size={16} /></button></div></div>
          <div className="film-invitation">{portrait && <DocumentaryPhoto photo={portrait} caption={false} rendition="portrait" />}<div className="film-invitation-content"><span className="bs-eyebrow"><Film size={14} />GROWTH FILM</span><h2>Su crecimiento,<br /><em>en imágenes.</em></h2><p>Vuelve a sus pequeños momentos.</p><Link className="glass-button" to={`/cycle/${cycle.id}/film`}>Ver su película<ArrowRight size={17} /></Link></div></div>
          <button className="ai-invitation" type="button" onClick={() => onOpen({ kind: 'ai' })}><span><Sparkles size={20} /></span><div><strong>Una segunda mirada</strong><small>Explora tu fotografía con Garden AI.</small></div><ChevronRight size={18} /></button>
        </div> : <PlantHistory cycle={cycle} onRecord={() => onOpen({ kind: 'observation' })} onEvent={openEvent} />}
      </div>
    </section>
    <footer className="botanical-colophon"><span>GARDEN X</span><span>Cultivar. Observar. Recordar.</span><Leaf size={15} /></footer>
  </div>
}
