import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { AttentionItem, GardenSummary } from '../../domain/types'
import { getAttention, getHome } from '../../lib/garden-api'
import { AttentionList } from './GardensPage'
import { AttentionTaskForm } from './AttentionTaskTools'

export function TodayPage() {
  const [items, setItems] = useState<AttentionItem[] | null>(null)
  const [gardens, setGardens] = useState<GardenSummary[] | null>(null)
  const [gardenId, setGardenId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextItems, nextGardens] = await Promise.all([getAttention(), getHome()])
      setItems(nextItems); setGardens(nextGardens)
      setGardenId((current) => current && nextGardens.some((garden) => garden.id === current) ? current : (nextGardens[0]?.id ?? ''))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar Atención.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes only after the server settles.
  useEffect(() => { void load() }, [load])

  return <AppShell title="Hoy" subtitle="Lo que requiere atención ahora">
    <section className="today-intro"><CheckCircle2 size={22} aria-hidden="true" /><div><h2>Atención</h2><p>Esta es la misma cola canónica que aparece en Jardines. Las novedades de visitas se consultan por separado.</p></div></section>
    {gardens && gardens.length > 0 && <section className="today-create"><div className="section-heading"><h2>Añadir seguimiento</h2><span>Manual</span></div>{gardens.length > 1 && <label>Jardín<select value={gardenId} onChange={(event) => setGardenId(event.target.value)}>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label>}{gardenId && <AttentionTaskForm gardenId={gardenId} onCreated={load} compact />}</section>}
    {!items && !error && <StatePanel kind="loading" title="Consultando atención" />}
    {error && <StatePanel kind="error" title="No se pudo cargar Atención" onRetry={() => void load()}>{error}</StatePanel>}
    {items && <AttentionList items={items} onChanged={load} />}
  </AppShell>
}
