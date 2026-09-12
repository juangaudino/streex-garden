import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const root = resolve('qa/growth-film-integration')
const fixtures = resolve(root, 'fixtures.ts')

export default defineConfig({
  root,
  publicDir: false,
  plugins: [react(), {
    name: 'isolated-growth-film-fixtures', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/garden-api')) return '\0qa-growth-film-api'
    },
    load(id) {
      if (id === '\0qa-growth-film-api') return `export { getSignedPhotoUrl } from ${JSON.stringify(fixtures)}`
    },
  }],
  server: { host: '127.0.0.1', port: 4195, strictPort: true },
  build: { outDir: resolve('artifacts/growth-film-integration/build'), emptyOutDir: true },
})
