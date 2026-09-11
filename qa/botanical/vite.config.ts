import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const previewAssets: Record<string, { path: string; type: string }> = {
  '/brand/garden-x-mark.png': { path: resolve('public/brand/garden-x-mark.png'), type: 'image/png' },
  '/audio/garden-growing-light-v1-loop.wav': { path: resolve('public/audio/garden-growing-light-v1-loop.wav'), type: 'audio/wav' },
  '/audio/garden-track-4-v1-loop.wav': { path: resolve('public/audio/garden-track-4-v1-loop.wav'), type: 'audio/wav' },
}

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
      server.middlewares.use((req, res, next) => {
        const asset = req.url ? previewAssets[req.url.split('?')[0]] : undefined
        if (!asset) { next(); return }
        if (!existsSync(asset.path)) { res.statusCode = 404; res.end(); return }
        res.setHeader('Content-Type', asset.type)
        res.setHeader('Cache-Control', 'private, max-age=3600')
        res.end(readFileSync(asset.path))
      })
    },
  }],
  publicDir: false,
  // Only the temporary preview domain may reach this isolated dev server.
  server: {
    host: '127.0.0.1',
    port: 4190,
    strictPort: true,
    allowedHosts: ['.loca.lt'],
    fs: { strict: true, allow: [resolve('qa/botanical')] },
  },
  build: { outDir: 'artifacts/botanical/build', emptyOutDir: true, rollupOptions: { input: resolve('qa/botanical/index.html') } },
})
