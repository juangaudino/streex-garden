import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { HomePage } from '../../src/features/gardens/HomePage'
import { GardensPage } from '../../src/features/gardens/GardensPage'
import { calls, failNextRead, failNextWrite, ownerId, resetScenario, setReadDelay, type Scenario } from './fixtures'
import '../../src/styles.css'
import '../../src/visual-pass-a.css'
import '../../src/visual-pass-b.css'

const user = { id: ownerId } as User
const scenarios: Scenario[] = ['normal', 'single', 'empty', 'dense', 'no-photo', 'first-visit', 'cached', 'open-session', 'read-error']
function Destination() { return <p>Destino simulado: {useLocation().pathname}. Esta ruta no ejecuta servicios ni cambia datos reales.</p> }
export function QaCollections() {
  const [run, setRun] = useState(0), [entry, setEntry] = useState('/'), [log, setLog] = useState('')
  return <><aside aria-label="Controles de QA aislada"><strong>QA AISLADA HOME / JARDINES · Medios sintéticos · Sin cuenta ni servicios reales · CSS final pendiente</strong>
    <label>Superficie<select value={entry} onChange={event => { setEntry(event.target.value); setRun(value => value + 1) }}><option value="/">Home</option><option value="/gardens">Jardines</option></select></label>
    <label>Escenario<select defaultValue="normal" onChange={event => { resetScenario(event.target.value as Scenario); setLog(''); setRun(value => value + 1) }}>{scenarios.map(scenario => <option key={scenario}>{scenario}</option>)}</select></label>
    <label><input type="checkbox" onChange={event => setReadDelay(event.target.checked)} />Lectura lenta simulada</label>
    <button type="button" onClick={failNextRead}>Fallar siguiente lectura</button><button type="button" onClick={failNextWrite}>Fallar siguiente guardado simulado</button>
    <button type="button" onClick={() => setRun(value => value + 1)}>Remontar superficie</button><button type="button" onClick={() => setLog(JSON.stringify(calls, null, 2))}>Ver llamadas simuladas</button>{log && <pre>{log}</pre>}
  </aside><MemoryRouter key={run} initialEntries={[entry]}><Routes><Route path="/" element={<HomePage user={user} />} /><Route path="/gardens" element={<GardensPage user={user} />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter></>
}
