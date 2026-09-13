import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('qa/surfaces-integration')
const fixtures = resolve(root, 'fixtures.ts')
const isolated = new Set(['garden-api', 'ai-gateway', 'offline-observation-store', 'export-download'])
const brands = ['garden-x-mark.png', 'garden-x-logo.png']
export default defineConfig({
  root, publicDir: false,
  plugins: [react(), {
    name: 'isolated-collection-services', enforce: 'pre',
    resolveId(id) {
      if (isolated.has(id.split('/').at(-1) ?? '')) return '\0qa-collection-services'
      if (id === 'virtual:pwa-register/react') return '\0qa-collection-pwa'
      if (id.includes('supabase')) throw new Error('Supabase is not permitted in isolated collection QA.')
    },
    load(id) {
      if (id === '\0qa-collection-services') return `export * from ${JSON.stringify(fixtures)}`
      if (id === '\0qa-collection-pwa') return 'export function useRegisterSW(){ return { needRefresh: [false], updateServiceWorker: async () => {} } }'
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = brands.find(name => req.url === `/brand/${name}`)
        if (!name) { next(); return }
        res.setHeader('Content-Type', 'image/png'); res.end(readFileSync(resolve('public/brand', name)))
      })
    },
    generateBundle() {
      for (const name of brands) this.emitFile({ type: 'asset', fileName: `brand/${name}`, source: readFileSync(resolve('public/brand', name)) })
    },
  }],
  server: { host: '127.0.0.1', port: 4198, strictPort: true },
  build: { outDir: resolve('artifacts/surfaces-integration/build'), emptyOutDir: true },
})
