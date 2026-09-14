/** Read-only browser characterization. Known defects are reported, never silently fixed.
 * Start the loopback harness first; optionally set QA_BROWSER_EXECUTABLE.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:4204'
const continuity = process.env.QA_PHASE === '04b'
const output = resolve(continuity ? 'artifacts/phase04-b/integrated' : 'artifacts/experience-integration/baseline')
mkdirSync(output, { recursive: true })
const session = continuity ? 'garden04b-integrated' : 'garden04a-baseline'
const report = { base: continuity ? '78a8385 + B1–B7' : '6cc1eba', generatedAt: new Date().toISOString(), observations: {}, screenshots: [], journeys: [], errors: [], fontChecks: [] }
function ab(...args) {
  const raw = execFileSync(process.env.QA_BROWSER_CLI || 'npx', [...(process.env.QA_BROWSER_CLI ? [] : ['--yes', 'agent-browser']), '--session', session, '--json', ...args], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 })
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
  evaluate(`document.addEventListener('click',()=>{window.__qaActualClickY=scrollY},{once:true,capture:true})`)
  ab('click', selector)
  return evaluate('window.__qaActualClickY')
}
function targetAudit(selector) {
  const count = evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
  const targets = []
  for (let i=0; i<count; i++) {
    const target = evaluate(`(()=>{const e=document.querySelectorAll(${JSON.stringify(selector)})[${i}];if(!e.getBoundingClientRect().width)return null;e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.textContent,width:r.width,height:r.height,centerHit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`)
    if (!target) continue
    assert.ok(target.width >= 43.99 && target.height >= 43.99, `Small target: ${JSON.stringify(target)}`)
    assert.equal(target.centerHit, true, `Covered target: ${target.name}`)
    targets.push(target)
  }
  return targets
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
  origin.y = click('.position-row a[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-identity h1')
  report.observations.N01 = { origin, arrival: evaluate(`({path:location.pathname,profileIdentity:!!document.querySelector('[data-place-origin="profile"]'),oldHeading:!!document.querySelector('.botanical-portrait h1'),heading:document.querySelector('.plant-identity h1').textContent,focusedHeading:document.activeElement===document.querySelector('.plant-identity h1'),scrollY,placeClones:document.querySelectorAll('.place-flight').length})`) }
  if (continuity) { assert.equal(report.observations.N01.arrival.profileIdentity, true); assert.equal(report.observations.N01.arrival.focusedHeading, true); assert.equal(report.observations.N01.arrival.scrollY, 0); assert.equal(report.observations.N01.arrival.placeClones, 0) }
  shot('plant-arrival-390')
  if (continuity) report.observations.plantTargets = targetAudit('.topbar__register,.topbar__actions .icon-button,.plant-page .breadcrumb,.plant-page .care-status .bs-text-button,.plant-page .glass-button')
  click('.plant-page .breadcrumb'); settle(); ab('wait', '.physical-map')
  report.observations.N01.return = evaluate(`({path:location.pathname,scrollY,focusedRow:document.activeElement===document.querySelector('.position-row a[href="/cycle/qa-cycle-1"]')})`)
  if (continuity) { assert.equal(report.observations.N01.return.focusedRow, true); assert.equal(report.observations.N01.return.scrollY, origin.y) }
  // Map origin as well as row origin.
  click('.map-site[href="/cycle/qa-cycle-1"]'); settle(); ab('wait', '.plant-identity h1')
  report.observations.N01.mapArrival = evaluate(`({scrollY,profileIdentity:!!document.querySelector('[data-place-origin="profile"]'),focusedHeading:document.activeElement===document.querySelector('.plant-identity h1')})`)
  if (continuity) assert.equal(report.observations.N01.mapArrival.focusedHeading, true)
  ab('back'); settle(); ab('wait', '.physical-map')
  report.observations.N01.browserReturn = evaluate(`({path:location.pathname,scrollY,focusedMap:document.activeElement===document.querySelector('.map-site[href="/cycle/qa-cycle-1"]')})`)
  if (continuity) assert.equal(report.observations.N01.browserReturn.focusedMap, true)
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
  if (continuity) report.observations.filmTargets = targetAudit('.film-page input[type=range],.film-page .bs-text-button')
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
    if (continuity && width < 720) { const g=report.observations.V03[width]; assert.equal(g.mainPadding, '0px'); assert.ok(g.composer.bottom <= g.nav.top, `Composer covered at ${width}`); assert.ok(g.documentHeight <= g.height+1, `Redundant external scroll at ${width}`) }
    if ([390, 690, 820, 1440].includes(width)) shot(`ask-empty-${width}`)
  }
  report.observations.askShortHeight = {}
  for (const width of [390, 690]) { viewport(width, 480); report.observations.askShortHeight[width] = evaluate(geometry) }
  if (continuity) for (const [width,g] of Object.entries(report.observations.askShortHeight)) { assert.ok(g.composer.bottom <= g.nav.top, `Short composer covered at ${width}`); assert.ok(g.documentHeight <= g.height+1, `Short external scroll at ${width}`) }
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
  if (continuity) {
    viewport(390); open('/?qaScenario=pending-drafts'); ab('wait', '.bc-home-hero')
    before = evaluate('window.__gardenQa.initialDataset')
    ab('click', 'button[aria-label="Cerrar sesión"]'); ab('wait', '.bs-signout-sheet[open]'); shot('pending-drafts-390')
    report.observations.draftSheet = evaluate(`({focus:document.activeElement.tagName,overflow:document.body.style.overflow,buttons:[...document.querySelectorAll('.bs-signout-sheet button')].map(e=>({name:e.textContent||e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),dialogWidth:document.querySelector('.bs-signout-sheet').getBoundingClientRect().width})`)
    assert.equal(report.observations.draftSheet.focus, 'H2'); assert.equal(report.observations.draftSheet.overflow, 'hidden')
    ab('press', 'Escape'); assert.equal(evaluate(`document.activeElement===document.querySelector('button[aria-label="Cerrar sesión"]')`), true)
    unchanged(before, 'B6: salida con borradores, Escape sin exportar/salir/borrar')
    open('/garden/qa-garden-1'); ab('wait', '.physical-map'); before = evaluate('window.__gardenQa.initialDataset')
    evaluate('window.__gardenQa.setDelay(1500)'); click('.map-site[href="/cycle/qa-cycle-1"]'); ab('wait', '.plant-identity h1'); settle()
    assert.equal(evaluate('document.activeElement===document.querySelector(".plant-identity h1")'), true)
    unchanged(before, 'B1: llegada lenta 1500ms al ciclo correcto')
    viewport(820); open('/cycle/qa-cycle-1'); ab('wait', '.plant-portrait')
    evaluate(`document.body.style.zoom='2'`)
    report.observations.zoomReflow = evaluate(`({zoom:getComputedStyle(document.body).zoom,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth})`)
    assert.ok(report.observations.zoomReflow.scrollWidth <= 820, '200% local reflow overflow')
    shot('plant-zoom-200'); evaluate(`document.body.style.zoom=''`)
  }
  report.browserErrors = ab('errors')
  if (continuity) assert.deepEqual(report.browserErrors.errors, [])
  console.log(continuity ? '04.B continuity regression complete; V01/V02 remain reserved for 04.C.' : '04.A characterization complete. Known defects are recorded separately from passing invariants.')
} catch (error) {
  report.errors.push(String(error))
  try { report.failureContext = { url: ab('get', 'url'), snapshot: ab('snapshot', '-i'), browserErrors: ab('errors') } } catch { /* Preserve the first failure. */ }
  throw error
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  ab('close')
}
