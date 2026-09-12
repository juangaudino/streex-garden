import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('qa/maintenance-integration')
const fixture = resolve(root, 'fixtures.ts')
const reference = resolve('artifacts/botanical/reference.jpg')
const names = [...readFileSync('src/lib/garden-api.ts', 'utf8').matchAll(/export (?:async )?function (\w+)/g)].map(match => match[1])
const overrides = ['getCycle', 'getGarden', 'getSignedPhotoUrl', 'getMaintenanceSession', 'markMaintenancePositionInspected', 'progressMaintenancePosition', 'setMaintenanceSessionState', 'recordCycleFact', 'createAttentionItem', 'recordHarvest', 'closeCycle', 'moveCycle', 'correctCyclePlanting', 'replaceCycle']
export default defineConfig({
  root, publicDir: false,
  define: { __MAINTENANCE_QA_REFERENCE__: JSON.stringify(existsSync(reference)) },
  plugins: [react(), {
    name: 'isolated-maintenance-fixtures', enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:pwa-register/react') return '\0qa-pwa'
      if (id.endsWith('/garden-api')) return '\0qa-garden'
      if (id.endsWith('/ai-gateway')) return '\0qa-ai'
      if (id.endsWith('/offline-observation-store')) return '\0qa-drafts'
      if (id.endsWith('/observation-sync')) return '\0qa-sync'
    },
    load(id) {
      if (id === '\0qa-pwa') return 'export const useRegisterSW=()=>({needRefresh:[false,()=>{}],offlineReady:[false,()=>{}],updateServiceWorker:async()=>{}})'
      if (id === '\0qa-garden') return `export * from ${JSON.stringify(fixture)};\n` + names.filter(name => !overrides.includes(name)).map(name => `export const ${name}=async()=>{throw new Error('Acción no disponible en esta demostración aislada')}`).join('\n')
      if (id === '\0qa-ai') return `export { requestAiCheck, requestDraftAiCheck } from ${JSON.stringify(fixture)}`
      if (id === '\0qa-drafts') return `export { getObservationDrafts, saveObservationDraft } from ${JSON.stringify(fixture)}`
      if (id === '\0qa-sync') return `export { syncObservationDraft } from ${JSON.stringify(fixture)}`
    },
    configureServer(server) { server.middlewares.use('/reference.jpg', (_req,res) => { if (!existsSync(reference)) { res.statusCode = 404; res.end(); return } res.setHeader('Content-Type','image/jpeg'); res.end(readFileSync(reference)) }) },
    generateBundle() { if (existsSync(reference)) this.emitFile({ type: 'asset', fileName: 'reference.jpg', source: readFileSync(reference) }) },
  }],
  server: { host: '127.0.0.1', port: 4192, strictPort: true },
  build: { outDir: resolve('artifacts/maintenance-integration/build'), emptyOutDir: true },
})
