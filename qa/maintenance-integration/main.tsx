import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MaintenancePage } from '../../src/features/gardens/MaintenancePage'
import '../../src/styles.css'
import '../../src/visual-pass-a.css'
import '../../src/visual-pass-b.css'

createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/maintenance/demo']}><Routes><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /><Route path="*" element={<div className="botanical-surface bm-finished" style={{ padding: 48 }}><h1>Recorrido de prueba terminado.</h1><p>Esta vista usa los componentes de la integración con datos de demostración. No está conectada a tu cuenta.</p><button className="bs-button" onClick={() => location.reload()}>Volver al recorrido</button></div>} /></Routes></MemoryRouter>)
