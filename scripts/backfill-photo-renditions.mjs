#!/usr/bin/env node
/**
 * Creates private, non-canonical JPEG renditions beside existing Garden X
 * originals. It is resumable: existing derivative objects are never replaced.
 *
 * Usage:
 *   supabase projects api-keys --project-ref <ref> --output json \
 *     | node scripts/backfill-photo-renditions.mjs --owner-id <uuid>
 *
 * The API-key JSON stays in the process pipe; this script never prints it.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value.slice(2), all[index + 1] ?? 'true'] : [] ).filter(([key]) => key))
const ownerId = args.get('owner-id')
const baseUrl = process.env.GARDEN_RENDERING_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const dryRun = args.has('dry-run')
const manifestPath = args.get('manifest')
if (!ownerId || !/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error('Se requiere --owner-id con un UUID válido.')
if (!baseUrl) throw new Error('Falta GARDEN_RENDERING_SUPABASE_URL en el entorno.')
if (!manifestPath) throw new Error('Se requiere --manifest con la salida JSON administrativa de garden.photos.')

const input = await new Promise((resolve) => {
  let value = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => { value += chunk })
  process.stdin.on('end', () => resolve(value))
})
const apiKeys = input.trim() ? JSON.parse(input) : []
const serviceKey = process.env.GARDEN_RENDERING_SERVICE_KEY ?? apiKeys.find((key) => key.type === 'legacy' && key.name === 'service_role')?.api_key
if (!serviceKey) throw new Error('Proporciona GARDEN_RENDERING_SERVICE_KEY o usa el JSON de `supabase projects api-keys` por stdin.')

function derivativePath(originalPath, kind) {
  const separator = originalPath.lastIndexOf('/')
  if (separator < 0) throw new Error(`Ruta de original inválida: ${originalPath}`)
  return `${originalPath.slice(0, separator)}/${kind}.jpg`
}
function headers(extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra }
}
function runSips(inputPath, outputPath, maxEdge, quality) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(Math.round(quality * 100)), '-Z', String(maxEdge), inputPath, '--out', outputPath], { stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`sips terminó con código ${code}.`)))
  })
}
async function responseBody(response, context) {
  if (response.ok) return response
  const detail = await response.text().catch(() => '')
  throw new Error(`${context}: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ''}`)
}
async function putIfMissing(path, bytes) {
  const response = await fetch(`${baseUrl}/storage/v1/object/garden-originals/${path}`, {
    method: 'POST',
    headers: headers({ 'content-type': 'image/jpeg', 'cache-control': 'max-age=31536000, immutable', 'x-upsert': 'false' }),
    body: bytes,
  })
  if (response.ok) return 'created'
  if (response.status === 409) return 'skipped'
  await responseBody(response, `No se pudo cargar ${path}`)
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const photos = Array.isArray(manifest) ? manifest : manifest.rows
if (!Array.isArray(photos)) throw new Error('El manifiesto no contiene una lista de fotografías.')
if (photos.some((photo) => typeof photo.storage_path !== 'string' || !photo.storage_path.startsWith(`${ownerId}/`))) {
  throw new Error('El manifiesto contiene una foto fuera del owner indicado; no se realizó ninguna carga.')
}
const temp = await mkdtemp(join(tmpdir(), 'garden-renditions-'))
const counts = { photos: 0, previewCreated: 0, displayCreated: 0, skipped: 0, failed: 0 }
try {
  for (const photo of photos) {
    counts.photos += 1
    const label = `${counts.photos}/${photos.length} ${photo.id}`
    try {
      if (dryRun) { console.log(`${label} dry-run ${photo.storage_path}`); continue }
      const originalResponse = await fetch(`${baseUrl}/storage/v1/object/garden-originals/${photo.storage_path}`, { headers: headers() })
      const original = Buffer.from(await (await responseBody(originalResponse, `No se pudo leer ${photo.storage_path}`)).arrayBuffer())
      if (photo.checksum_sha256 && createHash('sha256').update(original).digest('hex') !== photo.checksum_sha256) throw new Error('El checksum del original no coincide con el registro de Garden X.')
      const sourcePath = join(temp, `${randomUUID()}.source`)
      await writeFile(sourcePath, original)
      for (const [kind, maxEdge, quality] of [['preview', 640, 0.68], ['display', 1600, 0.78]]) {
        const outputPath = join(temp, `${randomUUID()}.${kind}.jpg`)
        await runSips(sourcePath, outputPath, maxEdge, quality)
        const outcome = await putIfMissing(derivativePath(photo.storage_path, kind), await readFile(outputPath))
        if (outcome === 'created') counts[`${kind}Created`] += 1
        else counts.skipped += 1
        await rm(outputPath, { force: true })
      }
      await rm(sourcePath, { force: true })
      console.log(`${label} ok`)
    } catch (error) {
      counts.failed += 1
      console.error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
console.log(JSON.stringify({ ...counts, mode: dryRun ? 'dry-run' : 'write' }))
if (counts.failed > 0) process.exitCode = 1
