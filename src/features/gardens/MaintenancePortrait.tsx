import { Camera, ImageOff } from 'lucide-react'
import type { GrowCycleDetail, MaintenancePosition } from '../../domain/types'
import { DocumentaryPhoto } from '../cycles/DocumentaryPhoto'
import { captureLabel } from '../cycles/photo-presentation'

export function MaintenancePortrait({ position, cycle }: { position: MaintenancePosition; cycle: GrowCycleDetail | null }) {
  // A previous or successor occupant must never supply the portrait.
  const belongsHere = cycle?.id === position.captured_grow_cycle_id && cycle?.position.id === position.position_id
    && position.current_grow_cycle_id === position.captured_grow_cycle_id && cycle?.state === 'active'
  const photo = belongsHere ? (cycle.cover_photo?.upload_status === 'uploaded' ? cycle.cover_photo : cycle.history.find(event => event.photo?.upload_status === 'uploaded')?.photo) : null
  return <div className={`bm-photo${photo ? '' : ' bm-photo--empty'}`}>
    {photo ? <><DocumentaryPhoto photo={photo} eager expandable caption={false} rendition="hero" /><div className="bm-photo-label"><Camera size={15} aria-hidden="true" /><span>{captureLabel(photo)}</span></div><div className="bm-photo-copy"><span className="bs-eyebrow">MIRAR TAMBIÉN ES CUIDAR</span><h2>Un momento<br /><em>para observar.</em></h2></div></> : <div className="bm-photo-empty"><ImageOff size={30} strokeWidth={1.3} aria-hidden="true" /><p>{belongsHere ? 'Aún no hay una fotografía guardada' : 'Sin fotografía de esta posición'}</p></div>}
  </div>
}
