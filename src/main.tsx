import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import './styles.css'
import './visual-pass-a.css'
import './visual-pass-b.css'
import './features/gardens/surfaces-botanical.css'
import './visual-depth-integration.css'
import './visual-fidelity-pass.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
