/** Read-only browser characterization. Known defects are reported, never silently fixed.
 * Start the loopback harness first; optionally set QA_BROWSER_EXECUTABLE.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:4204'
const output = resolve('artifacts/experience-integration/baseline')
mkdirSync(output, { recursive: true })
const session = 'garden04a-baseline'
const report = { base: '6cc1eba', generatedAt: new Date().toISOString(), observations: {}, screenshots: [], journeys: [], errors: [], fontChecks: [] }
function ab(...args) {
  const raw = execFileSync('npx', ['--yes', 'agent-browser', '--session', session, '--json', ...args], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 })
  const value = JSON.parse(raw)
  if (!value.success) throw new Error(JSON.stringify(value.error))
  return value.data
}
const evaluate = code => ab('eval', code).result
const settle = () => {
  ab('wait', '--load', 'networkidle')
  // External production fonts may stall; bound the wait and report fidelity
  // instead of hanging the entire run or disguising fallback type as approved.
  report.fontChecks.push(evaluate(`Promise.race([document.fonts.ready.then(()=>({path:location.pathname,status:document.fonts.status})),new Promise(resolve=>setTimeout(()=>resolve({path:location.pathname,status:'timeout'}),8000))])`))
}
const viewport = (width, height = 844) => ab('set', 'viewport', String(width), String(height))
function open(path) { ab('open', `${base}${path}`); settle() }
function shot(name) { ab('screenshot', resolve(output, `${name}.png`)); report.screenshots.push(`${name}.png`); console.log(`Captured ${name}`) }
function click(selector) {
  // A real scroll, never a forced click through the fixed navigation.
  evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`)
  const hittable = evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`)
  assert.equal(hittable, true, `Target covered after centering: ${selector}`)
  ab('click', selector)
}
function unchanged(before, label) {
  const after = evaluate('window.__gardenQa.snapshot()')
  assert.deepEqual(after.dataset, before, `${label}: fixture data changed`)
  assert.deepEqual(after.calls.filter(c => c.kind === 'blocked'), [], `${label}: attempted write or unexpected service`)
  assert.deepEqual(evaluate('window.__gardenQa.blockedRequests'), [], `${label}: remote request`)
  report.journeys.push({ label, calls: after.calls, canonicalDataUnchanged: true })
}
const geometry = `(()=>{const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,scrollY,mainPadding:getComputedStyle(document.querySelector('main')).paddingBottom,chat:box('.ask-garden-chat'),thread:box('.ask-garden-thread'),composer:box('.ask-garden-compose'),nav:box('.bottom-nav'),focus:document.activeElement?.outerHTML.slice(0,180)}})()`
const detailStyle = `(()=>{const e=document.querySelector('.plant-sheet .record-detail');const p=e.querySelector('p');const c=getComputedStyle(e),t=getComputedStyle(p);return {padding:c.padding,color:c.color,paragraphColor:t.color,paragraphMargin:t.margin,lineHeight:t.lineHeight,bodyOverflow:document.body.style.overflow,focus:document.activeElement?.tagName}})()`

try {
  if (process.env.QA_BROWSER_EXECUTABLE) ab('--executable-path', process.env.QA_BROWSER_EXECUTABLE, 'open', base)
  else ab('open', base)
  viewport(390); open('/')
  report.observations.entry = evaluate(`({viewport:document.querySelector('meta[name=viewport]').content,styles:[...document.styleSheets].map(s=>s.ownerNode?.getAttribute('data-vite-dev-id')||s.href),ai:'disabled by isolation config'})`)
  let before = evaluate('window.__gardenQa.initialDataset')
  report.observations.V01 = evaluate(`({className:document.querySelector('.bc-home-hero').className,titleColor:getComputedStyle(document.querySelector('.bc-home-hero h1')).color,eyebrowColor:getComputedStyle(document.querySelector('.bc-home-hero .bs-eyebrow')).color,expectedPhotoSelectorMatches:document.querySelectorAll('.bc-home-hero--photo').length})`)
  shot('home-390')
  click('.bc-home-hero a[href="/gardens"]'); settle(); ab('wait', '.bc-catalog'); shot('gardens-390')
  click('.bc-garden-card[href="/garden/qa-garden-1"]'); settle(); ab('wait', '.physical-map'); shot('garden-map-390')
  // Real row link, real PlantStudio, ordinary browser route transitions.
  evaluate(`document.querySelector('.position-row a[href="/cycle/qa-cycle-1"]').scrollIntoView({block:'center',behavior:'instant'})`)
  const origin = evaluate(`({y:scrollY,href:document.querySelector('.position-row a[href="/cycle/qa-cycle-1"]').getAttribute('href')})`)
  click('.position-row a[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-identity h1')
  report.observations.N01 = { origin, arrival: evaluate(`({path:location.pathname,profileIdentity:!!document.querySelector('[data-place-origin="profile"]'),oldHeading:!!document.querySelector('.botanical-portrait h1'),heading:document.querySelector('.plant-identity h1').textContent,focusedHeading:document.activeElement===document.querySelector('.plant-identity h1'),scrollY,placeClones:document.querySelectorAll('.place-flight').length})`) }
  shot('plant-arrival-390')
  click('.plant-page .breadcrumb'); settle(); ab('wait', '.physical-map')
  report.observations.N01.return = evaluate(`({path:location.pathname,scrollY,focusedRow:document.activeElement===document.querySelector('.position-row a[href="/cycle/qa-cycle-1"]')})`)
  // Map origin as well as row origin.
  click('.map-site[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-identity h1')
  report.observations.N01.mapArrival = evaluate(`({scrollY,profileIdentity:!!document.querySelector('[data-place-origin="profile"]'),focusedHeading:document.activeElement===document.querySelector('.plant-identity h1')})`)
  ab('back'); settle(); ab('wait', '.physical-map')
  report.observations.N01.browserReturn = evaluate(`({path:location.pathname,scrollY,focusedMap:document.activeElement===document.querySelector('.map-site[href="/cycle/qa-cycle-1"]')})`)
  click('.map-site[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-identity h1')
  click('.portrait-history-link'); ab('wait', '.timeline button'); click('.timeline button'); ab('wait', '.plant-sheet[open]')
  report.observations.V02 = { baseline: evaluate(detailStyle) }; shot('plant-event-390')
  // Diagnostic CSSOM isolation only: suppress the offending Film rules, measure,
  // then restore every byte. This never modifies a file or the shipped CSS.
  report.observations.V02.rules = evaluate(`(()=>{const sheet=[...document.styleSheets].find(s=>s.ownerNode?.getAttribute('data-vite-dev-id')?.endsWith('/growth-film.css'));if(!sheet)throw Error('Film stylesheet missing');window.__qaFilmRules=[...sheet.cssRules].filter(r=>r.selectorText?.startsWith('.record-detail')).map(r=>({r,css:r.style.cssText,selector:r.selectorText}));const result=window.__qaFilmRules.map(x=>({selector:x.selector,css:x.css}));for(const x of window.__qaFilmRules)x.r.style.cssText='';return result})()`)
  report.observations.V02.withoutGlobalFilmRules = evaluate(detailStyle); shot('plant-event-diagnostic-390')
  evaluate(`window.__qaFilmRules.forEach(x=>x.r.style.cssText=x.css);delete window.__qaFilmRules`)
  assert.deepEqual(evaluate(detailStyle), report.observations.V02.baseline)
  ab('press', 'Escape')
  report.observations.plantSheetReturn = evaluate(`({bodyOverflow:document.body.style.overflow,focusedTrigger:document.activeElement===document.querySelector('.timeline button'),dialogOpen:!!document.querySelector('.plant-sheet[open]')})`)
  assert.equal(report.observations.plantSheetReturn.focusedTrigger, true)
  assert.equal(report.observations.plantSheetReturn.bodyOverflow, '')
  click('[role="tab"][id$="-overview"]'); click('.plant-page a[href="/cycle/qa-cycle-1/film"]'); settle(); ab('wait', '.cinema-photo'); shot('film-390')
  ab('click', 'button[aria-label="Información de esta película"]'); ab('wait', '.film-sheet[open]'); shot('film-source-390')
  report.observations.filmSource = evaluate(`({text:document.querySelector('.film-sheet').textContent,sourceLink:document.querySelector('.film-sheet a').getAttribute('href')})`)
  click('.film-sheet a[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-portrait')
  unchanged(before, 'Home → Jardines → mapa/fila → Planta → Film/fuentes → Planta')
  ab('click', '.bottom-nav a[href="/gardens"]'); settle(); click('a[href="/maintenance/qa-session"]'); settle(); ab('wait', '.bm-footer'); shot('maintenance-390')
  ab('find', 'role', 'button', 'click', '--name', 'Se ve bien'); ab('wait', '.bs-sheet[open]'); shot('maintenance-confirmation-390'); ab('press', 'Escape')
  unchanged(before, 'Maintenance: abrir confirmación y cancelar no registra salud')
  // History is conditional on a saved record/pending draft; no write is invented
  // just to expose that link. Use the actual browser history to leave the session.
  report.observations.maintenanceHistory = evaluate(`({historyLinkPresent:!!document.querySelector('a[href="/cycle/qa-cycle-1"]'),path:location.pathname})`)
  ab('back'); settle(); ab('click', '.bottom-nav a[href="/today"]'); settle(); ab('wait', '.today-queue'); shot('today-390')
  ab('click', '.bottom-nav a[href="/ask-garden"]'); settle(); ab('wait', '#ask-garden-input')
  report.observations.V03 = {}
  for (const width of [320, 390, 640, 641, 690, 719, 720, 820, 1440]) {
    viewport(width); report.observations.V03[width] = evaluate(geometry)
    if ([390, 690, 820, 1440].includes(width)) shot(`ask-empty-${width}`)
  }
  report.observations.askShortHeight = {}
  for (const width of [390, 690]) { viewport(width, 480); report.observations.askShortHeight[width] = evaluate(geometry) }
  viewport(690); ab('fill', '#ask-garden-input', '¿Qué posiciones siguen sin germinación confirmada?'); ab('press', 'Enter'); settle(); ab('wait', '.ask-garden-answer')
  report.observations.askDeterministic = evaluate(`({answer:document.querySelector('.ask-garden-answer').textContent,geometry:${geometry}})`); shot('ask-answer-690')
  unchanged(before, 'Hoy/Ask determinístico: navegar y consultar conserva datos y servicios AI bloqueados')
  // Representative direct-entry states. Full visual closure remains 04.E.
  for (const [name, path, selector, width] of [
    ['home-no-photo', '/?qaScenario=no-photo', '.bc-home-hero', 390],
    ['home-error', '/?qaScenario=read-error', '.state-panel--error', 390],
    ['today-dense', '/today?qaScenario=dense', '.today-queue', 320],
    ['today-empty', '/today?qaScenario=empty', '.state-panel--empty', 820],
    ['plant-dense', '/cycle/qa-cycle-1?qaScenario=dense', '.plant-portrait', 1440],
    ['film-garden', '/garden/qa-garden-1/film', '.cinema-photo', 820],
    ['film-empty', '/cycle/qa-cycle-1/film?qaScenario=empty', '.film-empty', 390],
  ]) {
    viewport(width); open(path); ab('wait', selector); shot(`${name}-${width}`)
    before = evaluate('window.__gardenQa.initialDataset'); unchanged(before, `${name}: entrada directa`)
  }
  report.browserErrors = ab('errors')
  console.log('04.A characterization complete. Known defects are recorded separately from passing invariants.')
} catch (error) {
  report.errors.push(String(error))
  try { report.failureContext = { url: ab('get', 'url'), snapshot: ab('snapshot', '-i'), browserErrors: ab('errors') } } catch { /* Preserve the first failure. */ }
  throw error
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  ab('close')
}
