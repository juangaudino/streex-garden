import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdateNotice() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()

  if (!needRefresh[0]) return null

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <span>Hay una versión nueva disponible.</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        <RefreshCw size={15} aria-hidden="true" /> Actualizar
      </button>
    </aside>
  )
}
