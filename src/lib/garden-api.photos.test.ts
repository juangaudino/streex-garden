import { beforeEach, describe, expect, it, vi } from 'vitest'

const createSignedUrl = vi.fn()
const createSignedUrls = vi.fn()

vi.mock('./supabase', () => ({
  getSupabaseClient: () => ({
    storage: { from: () => ({ createSignedUrl, createSignedUrls }) },
  }),
}))

import { getSignedPhotoUrl } from './garden-api'

describe('batched private photo URLs', () => {
  beforeEach(() => {
    createSignedUrl.mockReset()
    createSignedUrls.mockReset()
  })

  it('batches same-tick stored-rendition requests and deduplicates paths', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }))

    const original = 'owner/photo-a/original.jpeg'
    const first = getSignedPhotoUrl(original, 'thumbnail')
    const second = getSignedPhotoUrl(original, 'history')

    await expect(Promise.all([first, second])).resolves.toEqual([
      'https://signed/owner/photo-a/preview.jpg',
      'https://signed/owner/photo-a/preview.jpg',
    ])
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith(['owner/photo-a/preview.jpg'], 300)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('resolves preview and display to their stored paths in one batch', async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }))

    const original = 'owner/photo-b/original.jpeg'
    const preview = getSignedPhotoUrl(original, 'thumbnail')
    const display = getSignedPhotoUrl(original, 'story')

    await expect(Promise.all([preview, display])).resolves.toEqual([
      'https://signed/owner/photo-b/preview.jpg',
      'https://signed/owner/photo-b/display.jpg',
    ])
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith([
      'owner/photo-b/preview.jpg',
      'owner/photo-b/display.jpg',
    ], 300)
  })

  it('reuses a still-valid cache entry and reports missing paths individually', async () => {
    createSignedUrls.mockResolvedValueOnce({
      data: [{ path: 'owner/photo-cache/display.jpg', signedUrl: 'https://signed/cache' }],
      error: null,
    })
    await expect(getSignedPhotoUrl('owner/photo-cache/original.jpeg', 'story')).resolves.toBe('https://signed/cache')
    await expect(getSignedPhotoUrl('owner/photo-cache/original.jpeg', 'story')).resolves.toBe('https://signed/cache')
    expect(createSignedUrls).toHaveBeenCalledTimes(1)

    createSignedUrls.mockResolvedValue({
      data: [{ path: 'owner/photo-ok/preview.jpg', signedUrl: 'https://signed/ok' }],
      error: null,
    })
    const ok = getSignedPhotoUrl('owner/photo-ok/original.jpeg', 'thumbnail')
    const missing = getSignedPhotoUrl('owner/photo-missing/original.jpeg', 'thumbnail')
    await expect(ok).resolves.toBe('https://signed/ok')
    await expect(missing).rejects.toThrow('No se pudo firmar')
  })
})
