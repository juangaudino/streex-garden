// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhotoEvidence } from '../../domain/types'
import { getSignedPhotoUrl } from '../../lib/garden-api'
import { PhotoLibraryDialog } from './PhotoLibraryDialog'

vi.mock('../../lib/garden-api', () => ({ getSignedPhotoUrl: vi.fn() }))

const photo: PhotoEvidence = {
  id: 'photo-a', storage_path: 'photos/a.jpg', original_filename: 'a.jpg', content_type: 'image/jpeg',
  byte_size: 1, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded',
}

let intersection: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getSignedPhotoUrl).mockResolvedValue('/signed/a.jpg')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn() })
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { intersection = callback }
      observe = vi.fn()
      disconnect = vi.fn()
    },
  })
})

afterEach(() => { cleanup(); intersection = undefined })

describe('PhotoLibraryDialog', () => {
  it('defers private URL requests until a thumbnail is near the viewport', async () => {
    render(<PhotoLibraryDialog open photos={[photo]} selectedId={null} onSelect={vi.fn()} onClose={vi.fn()} title="Elegir portada" />)
    expect(getSignedPhotoUrl).not.toHaveBeenCalled()
    expect(screen.getByText('Abriendo…')).toBeTruthy()

    await act(async () => intersection?.([{ isIntersecting: true }]))
    await waitFor(() => expect(getSignedPhotoUrl).toHaveBeenCalledWith(photo.storage_path, 'thumbnail'))
    await waitFor(() => expect(document.querySelector('.photo-library__media img')?.getAttribute('src')).toBe('/signed/a.jpg'))
  })
})
