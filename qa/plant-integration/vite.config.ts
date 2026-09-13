import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
const root = resolve('qa/plant-integration')
const fixtures = resolve(root, 'fixtures.ts')
const isolated = new Set(['garden-api', 'offline-observation-store', 'observation-sync', 'ai-gateway'])
export default defineConfig({
  root, publicDir: false,
  plugins: [react(), {
    name: 'isolated-plant-services', enforce: 'pre',
    resolveId(id) {
      if (isolated.has(id.split('/').at(-1) ?? '')) return '\0qa-plant-services'
      if (id === 'virtual:pwa-register/react') return '\0qa-plant-pwa'
      // A missed service import must fail closed, never reach a real account.
      if (id.includes('supabase')) throw new Error('Supabase is not permitted in isolated Planta QA.')
    },
    load(id) {
      if (id === '\0qa-plant-services') return `export * from ${JSON.stringify(fixtures)}`
      if (id === '\0qa-plant-pwa') return 'export function useRegisterSW(){ return { needRefresh: [false], updateServiceWorker: async () => {} } }'
    },
  }],
  server: { host: '127.0.0.1', port: 4196, strictPort: true },
  build: { outDir: resolve('artifacts/plant-integration/build'), emptyOutDir: true },
})
