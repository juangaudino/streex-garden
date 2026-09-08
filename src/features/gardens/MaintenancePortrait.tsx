import { useEffect, useState } from 'react'
import type { GrowCycleDetail, MaintenancePosition } from '../../domain/types'
import { getCycle } from '../../lib/garden-api'
import { BotanicalPortrait } from '../cycles/BotanicalPortrait'
import { PlaceIdentity } from '../../components/PlaceIdentity'

export function MaintenancePortrait({ position }: { position: MaintenancePosition }) {
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const matching = position.current_grow_cycle_id === position.captured_grow_cycle_id
  const cycleId = matching ? position.current_grow_cycle_id : null
  useEffect(() => {
    if (!cycleId) return
    let active = true
    void getCycle(cycleId).then((value) => { if (active) setCycle(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [cycleId])
  // A moved cycle's photo must not be presented as the occupant of this position.
  const belongsHere = cycle?.id === cycleId && cycle.position.id === position.position_id
  if (belongsHere) return <BotanicalPortrait review cycle={cycle} place={{ placeId: position.position_id, number: position.position_number, gardenId: position.garden_id, cropName: position.crop_name ?? '' }} />
  return <section className="maintenance-empty-portrait"><PlaceIdentity placeId={position.position_id} number={position.position_number} origin="review" /><div><p className="botanical-portrait__eyebrow">{position.garden_name} · Posición {position.position_number}</p><h2>{!matching ? 'Ocupante cambiado' : position.crop_name ?? 'Posición vacía'}</h2><p>{!matching ? 'Verifica el contexto antes de continuar.' : failed ? 'No se pudo abrir la fotografía del ciclo.' : cycle ? 'La evidencia consultada ya no corresponde a esta posición.' : cycleId ? 'Consultando evidencia documental…' : 'Un lugar para lo que viene.'}</p></div></section>
}
