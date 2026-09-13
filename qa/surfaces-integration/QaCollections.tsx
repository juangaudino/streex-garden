import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { HomePage } from '../../src/features/gardens/HomePage'
import { GardensPage } from '../../src/features/gardens/GardensPage'
import { TodayPage } from '../../src/features/gardens/TodayPage'
import { AskGardenPage } from '../../src/features/gardens/AskGardenPage'
import { calls, failNextRead, failNextWrite, ownerId, resetScenario, setReadDelay, scenarios, type Scenario } from './fixtures'
import '../../src/styles.css'
import '../../src/visual-pass-a.css'
import '../../src/visual-pass-b.css'
import '../../src/features/gardens/surfaces-botanical.css'

const user = { id: ownerId } as User
function Destination() { return <p>Destino simulado: {useLocation().pathname}. Esta ruta no ejecuta servicios ni cambia datos reales.</p> }
export function QaCollections() {
  const params = new URLSearchParams(window.location.search)
  const embedded = params.get('embed') === '1'
  const surfaceRoutes: Record<string, string> = { gardens: '/gardens', today: '/today', 'ask-garden': '/ask-garden' }
  const initialEntry = surfaceRoutes[params.get('surface') ?? ''] ?? '/'
  const requestedScenario = params.get('scenario') as Scenario | null
  const initialScenario = requestedScenario && scenarios.includes(requestedScenario) ? requestedScenario : 'normal'
  const [run, setRun] = useState(0), [entry, setEntry] = useState(initialEntry), [scenario, setScenario] = useState<Scenario>(initialScenario), [log, setLog] = useState('')
  return <>{!embedded && <aside aria-label="Controles de QA aislada"><strong>QA AISLADA FASE 03 · Medios y respuestas AI simulados · Sin cuenta ni servicios reales · Hoy/Ask: CSS final pendiente</strong>
    <label>Superficie<select value={entry} onChange={event => { setEntry(event.target.value); setRun(value => value + 1) }}><option value="/">Home</option><option value="/gardens">Jardines</option><option value="/today">Hoy</option><option value="/ask-garden">Ask Garden</option></select></label>
    <label>Escenario<select value={scenario} onChange={event => { const next = event.target.value as Scenario; resetScenario(next); setScenario(next); setLog(''); setRun(value => value + 1) }}>{scenarios.map(scenario => <option key={scenario}>{scenario}</option>)}</select></label>
    <label><input type="checkbox" onChange={event => setReadDelay(event.target.checked)} />Lectura lenta simulada</label>
    <button type="button" onClick={failNextRead}>Fallar siguiente lectura</button><button type="button" onClick={failNextWrite}>Fallar siguiente guardado simulado</button>
    <button type="button" onClick={() => setRun(value => value + 1)}>Remontar superficie</button><button type="button" onClick={() => setLog(JSON.stringify(calls, null, 2))}>Ver llamadas simuladas</button>{log && <pre>{log}</pre>}
  </aside>}<MemoryRouter key={run} initialEntries={[entry]}><Routes><Route path="/" element={<HomePage user={user} />} /><Route path="/gardens" element={<GardensPage user={user} />} /><Route path="/today" element={<TodayPage />} /><Route path="/ask-garden" element={<AskGardenPage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter></>
}
