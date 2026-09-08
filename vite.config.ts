import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const devCertificatePath = resolve(process.cwd(), '.dev-cert/streex-garden-cert.pem')
const devKeyPath = resolve(process.cwd(), '.dev-cert/streex-garden-key.pem')
const localHttps = existsSync(devCertificatePath) && existsSync(devKeyPath)
  ? { cert: readFileSync(devCertificatePath), key: readFileSync(devKeyPath) }
  : undefined

export default defineConfig({
  server: { https: localHttps },
  preview: { https: localHttps },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Streex Garden',
        short_name: 'Garden',
        description: 'Historia visual privada de tus jardines.',
        theme_color: '#f5f3eb',
        background_color: '#f5f3eb',
        display: 'standalone',
        lang: 'es',
        icons: [
          { src: '/icons/garden-x-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/garden-x-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff2}'],
      },
    }),
  ],
})
