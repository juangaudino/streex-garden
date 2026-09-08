import { useState, type FormEvent } from 'react'
import { createGarden } from '../../lib/garden-api'

export function CreateGardenForm({ onCreated, onCancel }: { onCreated: (gardenId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [systemModel, setSystemModel] = useState('URUQ')
  const [capacity, setCapacity] = useState('8')
  const [customCapacity, setCustomCapacity] = useState('6')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await createGarden({
        requestId: crypto.randomUUID(),
        name,
        systemModel,
        positionCapacity: Number(capacity === 'custom' ? customCapacity : capacity),
      })
      onCreated(result.garden_id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el jardín.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="editor-card" onSubmit={(event) => void handleSubmit(event)}>
      <h2>Configura el jardín</h2>
      <p>Podrás editar el mapa físico después de crearlo: añade espacios de cultivo, puntos técnicos y la distribución real de tu equipo.</p>
      <label>Nombre<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Por ejemplo, Jardín 1" /></label>
      <label>Modelo o sistema<input maxLength={80} value={systemModel} onChange={(event) => setSystemModel(event.target.value)} /></label>
      <fieldset>
        <legend>Posiciones</legend>
        <label className="choice"><input type="radio" name="capacity" checked={capacity === '8'} value="8" onChange={(event) => setCapacity(event.target.value)} /> URUQ de 8 posiciones</label>
        <label className="choice"><input type="radio" name="capacity" checked={capacity === '12'} value="12" onChange={(event) => setCapacity(event.target.value)} /> URUQ de 12 posiciones</label>
        <label className="choice"><input type="radio" name="capacity" checked={capacity === 'custom'} value="custom" onChange={(event) => setCapacity(event.target.value)} /> Otro sistema / mapa personalizado</label>
      </fieldset>
      {capacity === 'custom' && <label>Espacios iniciales de cultivo<input required min="1" max="36" inputMode="numeric" type="number" value={customCapacity} onChange={(event) => setCustomCapacity(event.target.value)} /></label>}
      {error && <p className="inline-message inline-message--error" role="alert">Error: {error}</p>}
      <div className="button-row"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear jardín'}</button><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  )
}
