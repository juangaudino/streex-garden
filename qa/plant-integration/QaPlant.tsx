import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CyclePage } from '../../src/features/cycles/CyclePage'
import { resetScenario, type Scenario, failNextRead, failNextWrite } from './fixtures'
import '../../src/styles.css'

export function QaPlant() {
  const [run, setRun] = useState(0)
  return <><aside aria-label="Controles de prueba"><strong>QA AISLADA · Fotos sintéticas · Sin cuenta ni servicios reales</strong><label>Escenario<select defaultValue="portrait" onChange={event => { resetScenario(event.target.value as Scenario); setRun(value => value + 1) }}>{['portrait', 'landscape', 'dense', 'empty', 'closed', 'approximate', 'unknown'].map(scenario => <option key={scenario}>{scenario}</option>)}</select></label><button onClick={failNextRead}>Fallar siguiente lectura</button><button onClick={failNextWrite}>Fallar siguiente escritura simulada</button></aside><MemoryRouter key={run} initialEntries={['/cycle/qa-plant']}><Routes><Route path="/cycle/:cycleId" element={<CyclePage />} /><Route path="*" element={<p>Destino fuera de esta prueba. Recarga para volver a Planta.</p>} /></Routes></MemoryRouter></>
}
