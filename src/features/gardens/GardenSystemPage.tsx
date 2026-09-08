import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail } from '../../domain/types'
import { getGarden } from '../../lib/garden-api'
import { GardenSystemEditor } from './GardenSystemEditor'

export function GardenSystemPage() {
  const { gardenId } = useParams()
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!gardenId) return
    setError(null)
    try { setGarden(await getGarden(gardenId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir el sistema.') }
  }, [gardenId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load writes only after the RPC settles.
  useEffect(() => { void load() }, [load])
  return <AppShell title="Editar sistema" subtitle={garden?.name ?? 'Jardín'} backTo={gardenId ? `/garden/${gardenId}` : '/'}>
    {garden === null && !error && <StatePanel kind="loading" title="Cargando el sistema" />}
    {error && <StatePanel kind="error" title="No se pudo abrir el sistema" onRetry={() => void load()}>{error}</StatePanel>}
    {garden && <GardenSystemEditor garden={garden} onSaved={load} />}
  </AppShell>
}
