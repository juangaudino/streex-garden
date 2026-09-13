import { createRoot } from 'react-dom/client'
import { QaCollections } from './QaCollections'
import { resetScenario, scenarios, type Scenario } from './fixtures'

const requested = new URLSearchParams(location.search).get('scenario') as Scenario | null
resetScenario(requested && scenarios.includes(requested) ? requested : 'normal')
sessionStorage.setItem('streex-garden-entry-seen', '1')
createRoot(document.getElementById('root')!).render(<QaCollections />)
