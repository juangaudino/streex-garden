import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail, GardenSummary } from '../../domain/types'
import { getGarden, getHome } from '../../lib/garden-api'
import { ObservationComposer } from './ObservationComposer'

export function RegisterPage() {
  const [gardens, setGardens] = useState<GardenSummary[] | null>(null)
  const [gardenId, setGardenId] = useState('')
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await getHome()
      setGardens(next)
      setGardenId((current) => current && next.some((item) => item.id === current) ? current : (next[0]?.id ?? ''))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo preparar el registro.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the loader writes only after its remote request settles.
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!gardenId) return undefined
    let active = true
    void getGarden(gardenId).then((next) => {
      if (!active) return
      setGarden(next)
      const first = next.positions.find((position) => position.current_cycle)?.current_cycle?.id ?? ''
      setCycleId((current) => next.positions.some((position) => position.current_cycle?.id === current) ? current : first)
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo abrir este jardín.') })
    return () => { active = false }
  }, [gardenId])
  const activePositions = garden?.positions.filter((position) => position.current_cycle) ?? []
  return <AppShell title="Registrar" subtitle="Una observación o fotografía confirmada" backTo="/">
    <section className="register-intro"><h2>¿Qué acabas de ver?</h2><p>Elige la planta. El registro quedará en su ciclo e historial; no crea una tarea automáticamente.</p></section>
    {!gardens && !error && <StatePanel kind="loading" title="Preparando tus jardines" />}
    {error && <StatePanel kind="error" title="No se pudo preparar el registro" onRetry={() => void load()}>{error}</StatePanel>}
    {gardens && gardens.length === 0 && <StatePanel kind="empty" title="Primero crea un jardín">Cuando tengas una planta activa, podrás registrar una observación desde aquí.</StatePanel>}
    {gardens && gardens.length > 0 && <section className="register-picker"><label>Jardín<select value={gardenId} onChange={(event) => setGardenId(event.target.value)}>{gardens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {garden && activePositions.length === 0 && <StatePanel kind="empty" title="No hay plantas activas en este jardín">Inicia un ciclo desde una posición antes de registrar una observación.</StatePanel>}
      {garden && activePositions.length > 0 && <label>Planta / posición<select value={cycleId} onChange={(event) => setCycleId(event.target.value)}>{activePositions.map((position) => <option key={position.current_cycle!.id} value={position.current_cycle!.id}>{position.current_cycle!.crop_name} · Posición {position.position_number}</option>)}</select></label>}
    </section>}
    {cycleId && <ObservationComposer growCycleId={cycleId} onSaved={load} onDraftQueued={async () => undefined} />}
  </AppShell>
}
