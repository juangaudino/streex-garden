import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fixture = resolve('qa/visual-pass-a-api.ts')
const overrides = ['getCycle', 'getGarden', 'getSignedPhotoUrl', 'getHome', 'getHomeDashboard', 'getAttention', 'getControlV2', 'acknowledgeHomeSnapshot', 'getOpenMaintenanceSession', 'getMaintenanceSession', 'progressMaintenancePosition', 'setMaintenanceSessionState']
const names = [...readFileSync('src/lib/garden-api.ts', 'utf8').matchAll(/export (?:async )?function (\w+)/g)].map((match) => match[1])
export default defineConfig({
  plugins: [react(), { name: 'isolated-presentation-fixtures', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:pwa-register/react') return '\0qa-pwa'; if (id.endsWith('/garden-api')) return '\0garden-qa-api' },
    load(id) { if (id === '\0qa-pwa') return 'export const useRegisterSW = () => ({needRefresh:[false,()=>{}],offlineReady:[false,()=>{}],updateServiceWorker:async()=>{}})'; if (id === '\0garden-qa-api') return `export * from ${JSON.stringify(fixture)};\n` + names.filter((name) => !overrides.includes(name)).map((name) => `export const ${name} = async () => { throw new Error('Acción deshabilitada en QA local') };`).join('\n') },
    configureServer(server) {
      server.middlewares.use('/qa-photo', (_request, response) => {
        if (!process.env.GARDEN_QA_PHOTO) { response.statusCode = 404; response.end(); return }
        response.setHeader('Content-Type', 'image/jpeg'); response.end(readFileSync(process.env.GARDEN_QA_PHOTO))
      })
    },
  }],
  server: { host: '127.0.0.1', port: 4180 },
})
