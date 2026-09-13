import { createRoot } from 'react-dom/client'
import { QaPlant } from './QaPlant'
import { resetScenario } from './fixtures'

resetScenario('portrait')
createRoot(document.getElementById('root')!).render(<QaPlant />)
