import { ArrowRight, CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../components/StatePanel'
import { attentionTimingLabel } from '../../domain/home-visit'
import type { AttentionItem } from '../../domain/types'
import { AttentionTaskEditor } from './AttentionTaskTools'

function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function AttentionList({ items, compact = false, onChanged }: {
  items: AttentionItem[]
  compact?: boolean
  onChanged?: () => Promise<void> | void
}) {
  const today = todayLocal()
  if (items.length === 0) return <StatePanel kind="empty" title="Sin pendientes">No hay acciones aceptadas que requieran atención ahora.</StatePanel>

  return <div className={`attention-list${compact ? ' attention-list--compact' : ''}`}>{items.map((item) => {
    const timing = attentionTimingLabel(item, today)
    const target = item.grow_cycle_id ? `/cycle/${item.grow_cycle_id}` : item.garden_id ? `/garden/${item.garden_id}` : null
    const context = item.grow_cycle_id
      ? [item.garden_name, item.position_number ? `Posición ${item.position_number}` : null, item.crop_name].filter(Boolean).join(' · ')
      : item.garden_name ?? 'Sistema'
    const body = <><span className="attention-item__icon" aria-hidden="true"><CircleAlert size={18} /></span><span><strong>{item.title}</strong><small>{context} · {timing}</small></span></>

    if (onChanged) return <article className="attention-item attention-item--managed" key={item.id}>{body}<div className="attention-item__manage"><AttentionTaskEditor task={item} onChanged={onChanged} /></div></article>
    return target ? <Link className="attention-item" to={target} key={item.id}>{body}<ArrowRight size={16} aria-hidden="true" /></Link> : <article className="attention-item" key={item.id}>{body}</article>
  })}</div>
}
