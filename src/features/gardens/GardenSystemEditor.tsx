import { useMemo, useState, type FormEvent } from 'react'
import { Check, Leaf, Plus, Wrench } from 'lucide-react'
import type { GardenDetail, PhysicalSite, PhysicalSiteKind } from '../../domain/types'
import { MAP_GRID_COLUMNS, MAP_GRID_ROWS, siteLabel } from '../../domain/layout-config'
import { addLayoutSite, updateLayoutSite } from '../../lib/garden-api'
import { PhysicalMap } from './PhysicalMap'

function firstFreeCoordinate(sites: PhysicalSite[]): { x: number; y: number } {
  for (let y = 1; y <= MAP_GRID_ROWS; y += 1) for (let x = 1; x <= MAP_GRID_COLUMNS; x += 1) {
    if (!sites.some((site) => site.is_active && site.grid_x === x && site.grid_y === y)) return { x, y }
  }
  return { x: 1, y: MAP_GRID_ROWS }
}

export function GardenSystemEditor({ garden, onSaved }: { garden: GardenDetail; onSaved: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const selected = garden.layout_sites.find((site) => site.id === selectedId) ?? null
  const free = useMemo(() => firstFreeCoordinate(garden.layout_sites), [garden.layout_sites])

  const saveSite = async (event: FormEvent<HTMLFormElement>, site: PhysicalSite) => {
    event.preventDefault(); setBusy(site.id); setError(null); setNotice(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await updateLayoutSite({ requestId: crypto.randomUUID(), siteId: site.id, gridX: Number(form.get('grid_x')), gridY: Number(form.get('grid_y')), siteKind: form.get('site_kind') as PhysicalSiteKind, active: form.get('is_active') === 'on', label: String(form.get('label') ?? '') })
      await onSaved(); setNotice(result.position_number ? `Guardado. Posición ${result.position_number} disponible en el mapa.` : 'Configuración guardada.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el punto físico.') }
    finally { setBusy(null) }
  }

  const addSite = async (kind: PhysicalSiteKind) => {
    setBusy(`add-${kind}`); setError(null); setNotice(null)
    try {
      const result = await addLayoutSite({ requestId: crypto.randomUUID(), gardenId: garden.id, gridX: free.x, gridY: free.y, siteKind: kind, label: kind === 'utility' ? 'Elemento técnico' : undefined })
      await onSaved(); setSelectedId(result.site_id); setNotice(result.position_number ? `Se añadió la posición ${result.position_number}.` : 'Se añadió el elemento técnico.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo añadir el punto físico.') }
    finally { setBusy(null) }
  }

  return <>
    <section className="system-editor-intro"><Wrench size={19} aria-hidden="true" /><div><h2>Editar sistema</h2><p>Los cambios describen el equipo físico. No cambian ciclos ni fotografías. Para retirar un punto con una planta activa, primero trasládala o cierra su ciclo.</p></div></section>
    <PhysicalMap garden={garden} editable onSelectSite={(site) => setSelectedId(site.id)} />
    {error && <p className="inline-message inline-message--error" role="alert">{error}</p>}
    {notice && <p className="inline-message" role="status"><Check size={16} aria-hidden="true" /> {notice}</p>}
    <section className="system-editor-actions" aria-label="Añadir punto físico">
      <div><h2>Añadir al mapa</h2><p>Se colocará primero en la coordenada libre {free.x}, {free.y}; puedes moverlo al guardar.</p></div>
      <div className="button-row"><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void addSite('grow')}><Leaf size={16} aria-hidden="true" />{busy === 'add-grow' ? 'Añadiendo…' : 'Añadir cultivo'}</button><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void addSite('utility')}><Plus size={16} aria-hidden="true" />{busy === 'add-utility' ? 'Añadiendo…' : 'Añadir elemento técnico'}</button></div>
    </section>
    <section aria-labelledby="physical-points-title"><div className="section-heading"><h2 id="physical-points-title">Puntos físicos</h2><span>{garden.layout_sites.length}</span></div>
      <div className="layout-site-list">{garden.layout_sites.map((site) => <article className={`layout-site-editor${selected?.id === site.id ? ' layout-site-editor--selected' : ''}`} key={site.id}>
        <button className="layout-site-editor__label" type="button" onClick={() => setSelectedId(site.id)}><span>{site.site_kind === 'grow' ? <Leaf size={16} aria-hidden="true" /> : <Wrench size={16} aria-hidden="true" />}</span><strong>{siteLabel(site)}</strong><small>{site.is_active ? `Mapa: ${site.grid_x}, ${site.grid_y}` : 'Retirado del mapa'}</small></button>
        {selected?.id === site.id && <form onSubmit={(event) => void saveSite(event, site)} className="layout-site-form">
          <label>Tipo<select name="site_kind" defaultValue={site.site_kind}><option value="grow">Espacio de cultivo</option><option value="utility">Elemento técnico</option></select></label>
          <label>Nombre del elemento técnico <span className="field-optional">opcional</span><input name="label" maxLength={80} defaultValue={site.label ?? ''} placeholder="Por ejemplo, llenado de agua" /></label>
          <div className="coordinate-fields"><label>Columna<input name="grid_x" type="number" min="1" max={MAP_GRID_COLUMNS} defaultValue={site.grid_x} /></label><label>Fila<input name="grid_y" type="number" min="1" max={MAP_GRID_ROWS} defaultValue={site.grid_y} /></label></div>
          <label className="choice"><input name="is_active" type="checkbox" defaultChecked={site.is_active} /> Visible y utilizable en el mapa</label>
          <div className="button-row"><button type="submit" className="primary-button" disabled={busy !== null}>{busy === site.id ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form>}
      </article>)}</div>
    </section>
  </>
}
