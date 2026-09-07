import { useState, type FormEvent } from 'react'
import { isValidPlantingDate } from '../../domain/invariants'
import { startCycle } from '../../lib/garden-api'

export function StartCycleForm({ positionId, positionNumber, onCreated, onCancel }: {
  positionId: string
  positionNumber: number
  onCreated: (cycleId: string) => void
  onCancel: () => void
}) {
  const [cropName, setCropName] = useState('')
  const [plantedOn, setPlantedOn] = useState('')
  const [precision, setPrecision] = useState<'exact' | 'approximate' | 'unknown'>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const validDate = isValidPlantingDate(plantedOn, precision)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validDate) {
      setError('Indica una fecha o marca la fecha como desconocida.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await startCycle({ requestId: crypto.randomUUID(), positionId, cropName, plantedOn: plantedOn || null, plantedOnPrecision: precision })
      onCreated(result.grow_cycle_id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar el ciclo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="editor-card" onSubmit={(event) => void handleSubmit(event)}>
      <h2>Iniciar ciclo en Posición {positionNumber}</h2>
      <p>Crearás un ciclo nuevo; la posición se mantiene como una identidad física independiente.</p>
      <label>Planta o variedad<input autoFocus required maxLength={100} value={cropName} onChange={(event) => setCropName(event.target.value)} placeholder="Por ejemplo, Cebollín" /></label>
      <fieldset>
        <legend>Fecha de siembra</legend>
        <label className="choice"><input type="radio" name="precision" checked={precision === 'unknown'} value="unknown" onChange={() => { setPrecision('unknown'); setPlantedOn('') }} /> Desconocida</label>
        <label className="choice"><input type="radio" name="precision" checked={precision === 'exact'} value="exact" onChange={() => setPrecision('exact')} /> Exacta</label>
        <label className="choice"><input type="radio" name="precision" checked={precision === 'approximate'} value="approximate" onChange={() => setPrecision('approximate')} /> Aproximada</label>
        {precision !== 'unknown' && <label>Fecha<input type="date" required value={plantedOn} onChange={(event) => setPlantedOn(event.target.value)} /></label>}
      </fieldset>
      {error && <p className="inline-message inline-message--error" role="alert">Error: {error}</p>}
      <div className="button-row"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Iniciar ciclo'}</button><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  )
}
