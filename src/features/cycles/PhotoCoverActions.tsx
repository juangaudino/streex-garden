import { useState } from 'react'
import { setCycleCover, setGardenCover, setHomeHero } from '../../lib/garden-api'

export function PhotoCoverActions({ gardenId, cycleId, photoId, onMessage }: { gardenId: string; cycleId?: string; photoId: string; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (action: 'garden' | 'home') => {
    setBusy(true)
    try {
      if (action === 'garden') await setGardenCover({ requestId: crypto.randomUUID(), gardenId, photoId })
      else await setHomeHero({ requestId: crypto.randomUUID(), photoId })
      onMessage(action === 'garden' ? 'Foto establecida como portada del jardín.' : 'Foto establecida como portada de Home.')
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : 'No se pudo establecer la portada.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="documentary-photo__actions-row">{cycleId && <button type="button" className="secondary-button secondary-button--compact" disabled={busy} onClick={() => { setBusy(true); void setCycleCover({ requestId: crypto.randomUUID(), growCycleId: cycleId, photoId }).then(() => onMessage('Foto establecida como portada de la planta.')).catch((reason) => onMessage(reason instanceof Error ? reason.message : 'No se pudo establecer la portada.')).finally(() => setBusy(false)) }}>Portada de la planta</button>}<button type="button" className="secondary-button secondary-button--compact" disabled={busy} onClick={() => void run('garden')}>Portada del jardín</button><button type="button" className="secondary-button secondary-button--compact" disabled={busy} onClick={() => void run('home')}>Portada Home</button></div>
}
