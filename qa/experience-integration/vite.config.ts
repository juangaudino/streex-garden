import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '../..')
const here = resolve(repo, 'qa/experience-integration')
const source = (file: string) => readFileSync(resolve(repo, file), 'utf8')
const services = resolve(here, 'services.ts')
const setup = resolve(here, 'setup.ts')
const isolated = new Set(['garden-api', 'ai-gateway', 'supabase', 'offline-observation-store', 'observation-sync', 'export-download'])
const assets = ['brand/garden-x-logo.png', 'brand/garden-x-mark.png', 'apple-touch-icon.png']
// Fonts keep their production requests. No account/API/telemetry connection is allowed.
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' ws://127.0.0.1:4204; object-src 'none'; base-uri 'self'; form-action 'self'"

export default defineConfig({
  root: repo, envDir: here, publicDir: false,
  define: { 'import.meta.env.VITE_GARDEN_AI_ENABLED': JSON.stringify('false') },
  plugins: [react(), {
    name: 'garden-04a-isolation', enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:pwa-register/react') return '\0qa04:pwa'
      const name = id.split('/').at(-1)?.replace(/\.tsx?$/, '') ?? ''
      if (isolated.has(name)) return `\0qa04:${name}`
      if (id.includes('supabase')) throw new Error('04.A rejects real Supabase runtime imports')
    },
    load(id) {
      if (!id.startsWith('\0qa04:')) return
      const name = id.slice('\0qa04:'.length)
      if (name === 'pwa') return 'export const useRegisterSW=()=>({needRefresh:[false],updateServiceWorker:async()=>{}})'
      if (name === 'supabase') return `export const hasSupabaseConfiguration=()=>true; export const getSupabaseClient=()=>({auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})`
      if (name === 'ai-gateway') return `import {blocked} from ${JSON.stringify(services)}; export const aiGatewayStatus=()=> 'disabled'; export const askGarden=(...a)=>blocked('askGarden',a); export const requestAiCheck=(...a)=>blocked('requestAiCheck',a); export const requestDraftAiCheck=(...a)=>blocked('requestDraftAiCheck',a);`
      // Export names follow the source; any port not in invoke's read allowlist throws.
      const names = [...source(`src/lib/${name}.ts`).matchAll(/export (?:async )?function (\w+)/g)].map(m => m[1])
      return `import {invoke} from ${JSON.stringify(services)};\n${names.map(n => `export const ${n}=(...a)=>invoke(${JSON.stringify(n)},a)`).join('\n')}`
    },
    transform(code, id) {
      if (id.split('?')[0] === resolve(repo, 'src/main.tsx')) return { code: `import ${JSON.stringify(setup)};\n${code}`, map: null }
    },
    transformIndexHtml(html) {
      return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}" />`)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0].slice(1)
        if (!path || !assets.includes(path)) { next(); return }
        res.setHeader('Content-Type', 'image/png'); res.end(readFileSync(resolve(repo, 'public', path)))
      })
    },
    generateBundle() {
      for (const fileName of assets) this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(repo, 'public', fileName)) })
    },
    writeBundle(_options, bundle) {
      const fingerprints = Object.values(bundle).flatMap(b => b.type === 'asset' && b.fileName.endsWith('.css') ? [{ file: b.fileName, sha256: createHash('sha256').update(b.source).digest('hex') }] : [])
      this.info(`04.A CSS fingerprints: ${JSON.stringify(fingerprints)}`)
    },
  }],
  server: { host: '127.0.0.1', port: 4204, strictPort: true },
  preview: { host: '127.0.0.1', port: 4204, strictPort: true },
  build: { outDir: resolve(repo, 'artifacts/experience-integration/build'), emptyOutDir: true },
})
