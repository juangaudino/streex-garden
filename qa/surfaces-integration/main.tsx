import { createRoot } from 'react-dom/client'
import { QaCollections } from './QaCollections'
import { resetScenario } from './fixtures'

resetScenario('normal')
sessionStorage.setItem('streex-garden-entry-seen', '1')
createRoot(document.getElementById('root')!).render(<QaCollections />)
