import { AwsClient } from 'npm:aws4fetch@1.0.20'
import { signedR2Request } from './r2-photo-storage-http.ts'

export type R2PhotoTier = 'master' | 'display' | 'preview'

const tierFilename: Record<R2PhotoTier, string> = {
  master: 'original.jpg',
  display: 'display.jpg',
  preview: 'preview.jpg',
}

let client: AwsClient | null = null

function configuration() {
  const endpoint = Deno.env.get('R2_ENDPOINT')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET')
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error('R2 media storage is not configured')
  if (!/^https:\/\//i.test(endpoint)) throw new Error('R2 media storage endpoint is invalid')
  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

function storageClient() {
  if (!client) {
    const config = configuration()
    client = new AwsClient({
      service: 's3',
      region: 'auto',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    })
  }
  return { client, bucket: configuration().bucket }
}

async function requestR2(input: {
  method: 'DELETE' | 'GET' | 'HEAD' | 'PUT'
  key: string
  headers?: HeadersInit
  body?: BodyInit
}) {
  const { client: signer, bucket } = storageClient()
  return signedR2Request(signer.fetch.bind(signer), {
    endpoint: configuration().endpoint,
    bucket,
    method: input.method,
    key: input.key,
    headers: input.headers,
    body: input.body,
  })
}

export function canonicalR2Key(storagePath: string, tier: R2PhotoTier): string {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.jpg$/i.test(storagePath)) throw new Error('Photo storage path is not a canonical Garden media path')
  return storagePath.replace(/\/original\.jpg$/i, `/${tierFilename[tier]}`)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function putR2PhotoObject(input: {
  storagePath: string
  tier: R2PhotoTier
  bytes: Uint8Array
  contentType: string
  cacheControl: string
  checksumSha256: string
}): Promise<{ key: string; size: number; checksumSha256: string; created: boolean }> {
  const key = canonicalR2Key(input.storagePath, input.tier)
  const actualChecksum = await sha256Hex(input.bytes)
  if (actualChecksum !== input.checksumSha256) throw new Error(`R2 ${input.tier} checksum mismatch`)
  let existing: Awaited<ReturnType<typeof headR2PhotoObject>> | null = null
  try { existing = await headR2PhotoObject(input.storagePath, input.tier) } catch (error) {
    if (!isNotFound(error)) throw error
  }
  if (existing) {
    if (existing.size !== input.bytes.byteLength || existing.metadata?.['garden-sha256'] !== actualChecksum) throw new Error(`R2 ${input.tier} object collision`)
    return { key, size: existing.size, checksumSha256: actualChecksum, created: false }
  }
  await requestR2({
    method: 'PUT',
    key,
    // Use native fetch through aws4fetch. The AWS SDK's default Node HTTP
    // handler is not reliable for request bodies in Supabase Edge Runtime.
    headers: {
      'Cache-Control': input.cacheControl,
      'Content-Length': String(input.bytes.byteLength),
      'Content-Type': input.contentType,
      'x-amz-meta-garden-sha256': actualChecksum,
    },
    body: input.bytes,
  })
  const verified = await headR2PhotoObject(input.storagePath, input.tier)
  if (verified.size !== input.bytes.byteLength || verified.metadata?.['garden-sha256'] !== actualChecksum) throw new Error(`R2 ${input.tier} verification failed`)
  return { key, size: verified.size, checksumSha256: actualChecksum, created: true }
}

export async function headR2PhotoObject(storagePath: string, tier: R2PhotoTier) {
  const key = canonicalR2Key(storagePath, tier)
  const response = await requestR2({ method: 'HEAD', key })
  return {
    key,
    size: Number(response.headers.get('content-length') ?? '0'),
    contentType: response.headers.get('content-type'),
    metadata: { 'garden-sha256': response.headers.get('x-amz-meta-garden-sha256') ?? '' },
  }
}

export async function getR2PhotoObject(storagePath: string, tier: R2PhotoTier): Promise<{ bytes: Uint8Array; contentType: string }> {
  const key = canonicalR2Key(storagePath, tier)
  const response = await requestR2({ method: 'GET', key })
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.byteLength) throw new Error('R2 photo object is empty')
  return { bytes, contentType: response.headers.get('content-type') ?? 'image/jpeg' }
}

export async function deleteR2PhotoObjects(storagePath: string, tiers: R2PhotoTier[] = ['master', 'display', 'preview']) {
  const keys = tiers.map((tier) => canonicalR2Key(storagePath, tier))
  await Promise.all(keys.map((key) => requestR2({ method: 'DELETE', key })))
  return keys
}

function isNotFound(error: unknown) {
  const value = error as { statusCode?: number; name?: string; code?: string; Code?: string }
  return value?.statusCode === 404 || value?.name === 'NotFound' || value?.code === 'NoSuchKey' || value?.Code === 'NoSuchKey'
}
