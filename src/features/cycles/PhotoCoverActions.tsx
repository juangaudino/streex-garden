import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { setCycleCover, setGardenCover, setHomeHero } from '../../lib/garden-api'

export function PhotoCoverActions({ gardenId, cycleId, photoId, onMessage, onChanged }: {
  gardenId: string; cycleId?: string; photoId: string; onMessage: (message: string) => void; onChanged?: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const saving = useRef(false)
  const request = useRef({ key: '', id: '' })
  const run = async (action: 'cycle' | 'garden' | 'home') => {
    if (saving.current || (action === 'cycle' && !cycleId)) return
    saving.current = true; setBusy(true)
    try {
      const key = JSON.stringify([action, gardenId, cycleId, photoId])
      if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
      const requestId = request.current.id
      if (action === 'cycle') await setCycleCover({ requestId, growCycleId: cycleId!, photoId })
      else if (action === 'garden') await setGardenCover({ requestId, gardenId, photoId })
      else await setHomeHero({ requestId, photoId })
      onMessage(action === 'cycle' ? 'Foto establecida como portada de la planta.' : action === 'garden' ? 'Foto establecida como portada del jardín.' : 'Foto establecida como portada de Home.')
      setOpen(false)
      request.current = { key: '', id: '' }
      try { await onChanged?.() }
      catch { onMessage('La portada quedó guardada. No se pudo actualizar la vista; vuelve a abrirla para comprobarlo.') }
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : 'No se pudo establecer la portada.')
    } finally { saving.current = false; setBusy(false) }
  }
  return <div className="photo-cover-menu"><button className="secondary-button secondary-button--compact photo-cover-menu__trigger" type="button" aria-expanded={open} aria-haspopup="menu" disabled={busy} onClick={() => setOpen(value => !value)}><span>Usar como portada</span><ChevronDown size={15} aria-hidden="true" /></button>{open && <div className="photo-cover-menu__panel" role="menu">{cycleId && <button type="button" role="menuitem" disabled={busy} onClick={() => void run('cycle')}>Portada de la planta</button>}<button type="button" role="menuitem" disabled={busy} onClick={() => void run('garden')}>Portada del jardín</button><button type="button" role="menuitem" disabled={busy} onClick={() => void run('home')}>Portada Home</button></div>}</div>
}
