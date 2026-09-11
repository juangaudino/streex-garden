import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Separate entry point. No production API, authentication, uploads or mutations.
export default defineConfig({
  plugins: [react(), {
    name: 'botanical-local-reference',
    configureServer(server) {
      server.middlewares.use('/botanical-reference.jpg', (_req, res) => {
        const path = resolve('artifacts/botanical/reference.jpg')
        if (!existsSync(path)) { res.statusCode = 404; res.end(); return }
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader('Cache-Control', 'private, max-age=3600')
        res.end(readFileSync(path))
      })
    },
  }],
  // Only the temporary preview domain may reach this isolated dev server.
  server: { host: '127.0.0.1', port: 4190, strictPort: true, allowedHosts: ['.loca.lt'] },
  build: { outDir: 'artifacts/botanical/build', emptyOutDir: true, rollupOptions: { input: resolve('qa/botanical/index.html') } },
})
