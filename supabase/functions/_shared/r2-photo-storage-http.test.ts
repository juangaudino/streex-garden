import { describe, expect, it } from 'vitest'
import { R2RequestError, r2ObjectUrl, signedR2Request } from './r2-photo-storage-http'

describe('R2 Edge Runtime transport', () => {
  it('uses a native-fetch-compatible binary PUT request for the signed R2 client', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const response = await signedR2Request(async (url, init) => {
      seenUrl = url
      seenInit = init
      return new Response(null, { status: 200 })
    }, {
      endpoint: 'https://account.r2.cloudflarestorage.com/',
      bucket: 'garden-media',
      method: 'PUT',
      key: 'owner/photo/original.jpg',
      headers: { 'Content-Type': 'image/jpeg' },
      body: bytes,
    })

    expect(response.ok).toBe(true)
    expect(seenUrl).toBe('https://account.r2.cloudflarestorage.com/garden-media/owner/photo/original.jpg')
    expect(seenInit?.method).toBe('PUT')
    expect(seenInit?.body).toBe(bytes)
  })

  it('preserves the R2 status and error code for missing-object handling', async () => {
    await expect(signedR2Request(async () => new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 }), {
      endpoint: 'https://account.r2.cloudflarestorage.com',
      bucket: 'garden-media',
      method: 'HEAD',
      key: 'owner/photo/display.jpg',
    })).rejects.toMatchObject({ statusCode: 404, code: 'NoSuchKey' })
    expect(() => new R2RequestError(404, 'NoSuchKey')).not.toThrow()
  })

  it('encodes key segments without changing the canonical slash structure', () => {
    expect(r2ObjectUrl('https://account.r2.cloudflarestorage.com', 'garden media', 'owner/photo/a b.jpg'))
      .toBe('https://account.r2.cloudflarestorage.com/garden%20media/owner/photo/a%20b.jpg')
  })
})
