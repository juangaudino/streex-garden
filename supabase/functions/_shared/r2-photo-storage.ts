import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3@3.1141.0'

export type R2PhotoTier = 'master' | 'display' | 'preview'

const tierFilename: Record<R2PhotoTier, string> = {
  master: 'original.jpg',
  display: 'display.jpg',
  preview: 'preview.jpg',
}

let client: S3Client | null = null

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
    client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    })
  }
  return { client, bucket: configuration().bucket }
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
  const { client: s3, bucket } = storageClient()
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
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    // Pass bytes directly. A Blob makes the Deno/Node HTTP bridge treat the
    // request as a streaming body and can terminate it with an unexpected EOF.
    Body: input.bytes,
    ContentLength: input.bytes.byteLength,
    ContentType: input.contentType,
    CacheControl: input.cacheControl,
    Metadata: { 'garden-sha256': actualChecksum },
  }))
  const verified = await headR2PhotoObject(input.storagePath, input.tier)
  if (verified.size !== input.bytes.byteLength || verified.metadata?.['garden-sha256'] !== actualChecksum) throw new Error(`R2 ${input.tier} verification failed`)
  return { key, size: verified.size, checksumSha256: actualChecksum, created: true }
}

export async function headR2PhotoObject(storagePath: string, tier: R2PhotoTier) {
  const { client: s3, bucket } = storageClient()
  const key = canonicalR2Key(storagePath, tier)
  const response = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  return { key, size: response.ContentLength ?? 0, contentType: response.ContentType ?? null, metadata: response.Metadata ?? {} }
}

export async function getR2PhotoObject(storagePath: string, tier: R2PhotoTier): Promise<{ bytes: Uint8Array; contentType: string }> {
  const { client: s3, bucket } = storageClient()
  const key = canonicalR2Key(storagePath, tier)
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) throw new Error('R2 photo object is empty')
  const bytes = await response.Body.transformToByteArray()
  return { bytes, contentType: response.ContentType ?? 'image/jpeg' }
}

export async function deleteR2PhotoObjects(storagePath: string, tiers: R2PhotoTier[] = ['master', 'display', 'preview']) {
  const { client: s3, bucket } = storageClient()
  const keys = tiers.map((tier) => canonicalR2Key(storagePath, tier))
  await Promise.all(keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))))
  return keys
}

function isNotFound(error: unknown) {
  const value = error as { $metadata?: { httpStatusCode?: number }; name?: string; Code?: string }
  return value?.$metadata?.httpStatusCode === 404 || value?.name === 'NotFound' || value?.Code === 'NoSuchKey'
}
