import { defineConfig } from 'vite'
// Local renderer proof only. No router, auth, backend, PWA or product bundle.
export default defineConfig({ optimizeDeps: { entries: ['qa/film-core.html'] }, server: { host: '127.0.0.1', port: 4194, strictPort: true } })
