import { failRead, reset, setDelay, snapshot } from './services'
import { scenarios, type Scenario } from './data'

const requested = new URLSearchParams(location.search).get('qaScenario') as Scenario | null
const scenario = requested && scenarios.includes(requested) ? requested : 'normal'
reset(scenario)
sessionStorage.setItem('streex-garden-entry-seen', '1')
// Dedicated loopback origin; only the synthetic owner's local visit keys are used.
const blockedRequests: string[] = []
const fetchOriginal = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href)
  if (url.origin !== location.origin && !['data:', 'blob:'].includes(url.protocol)) {
    blockedRequests.push(`${url.origin}${url.pathname}`)
    return Promise.reject(new Error('04.A blocks remote fetch'))
  }
  return fetchOriginal(input, init)
}
document.addEventListener('securitypolicyviolation', event => blockedRequests.push(event.blockedURI))
Object.defineProperty(window, '__gardenQa', { value: { initialDataset: snapshot().dataset, snapshot, failRead, setDelay, blockedRequests } })
document.title = 'QA 04.A · DATOS SINTÉTICOS · Garden'
