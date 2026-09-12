import { describe, expect, it, vi } from 'vitest'
import type { FilmComposition } from './growth-film-composition'
import type { FilmArtifact } from './growth-film-export'
import { enterFilmFullscreen, FilmRenderSession } from './growth-film-session'

const plan = (key: string) => ({ key } as FilmComposition)
const artifact = (key: string): FilmArtifact => ({ compositionKey: key, blob: new Blob(['video']), url: `blob:${key}`, mimeType: 'video/mp4', durationMs: 6_800, dispose: vi.fn() })
const resolver = vi.fn()
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('Film session ownership and preview/download parity', () => {
  it('uses one render and the same artifact for preview and download', async () => {
    const video = artifact('a')
    const renderer = vi.fn().mockResolvedValue(video)
    const session = new FilmRenderSession(renderer)
    await session.prepare(plan('a'), resolver)
    await session.prepare(plan('a'), resolver)
    expect(renderer).toHaveBeenCalledTimes(1)
    expect(session.artifactFor('a')).toBe(video)
    expect(session.artifactFor('different-selection')).toBeNull()
    session.clear()
    expect(video.dispose).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().status).toBe('idle')
  })

  it('cancels obsolete work and cannot publish a late video or progress update', async () => {
    const oldJob = deferred<FilmArtifact>()
    const newJob = deferred<FilmArtifact>()
    const renderer = vi.fn().mockReturnValueOnce(oldJob.promise).mockReturnValueOnce(newJob.promise)
    const session = new FilmRenderSession(renderer)
    const oldPending = session.prepare(plan('a'), resolver)
    const newPending = session.prepare(plan('b'), resolver)
    expect(renderer.mock.calls[0][1].signal.aborted).toBe(true)
    const stale = artifact('a')
    oldJob.resolve(stale)
    await oldPending
    renderer.mock.calls[0][1].onProgress({ phase: 'rendering', completed: 2, total: 2 })
    expect(stale.dispose).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'preparing', compositionKey: 'b', progress: null })
    const latest = artifact('b')
    newJob.resolve(latest)
    await newPending
    expect(session.artifactFor('b')).toBe(latest)
    session.clear()
    expect(latest.dispose).toHaveBeenCalledTimes(1)
  })

  it('does not turn a music failure into a silently muted successful export', async () => {
    const session = new FilmRenderSession(vi.fn().mockRejectedValue(new Error('No se pudo cargar la pista elegida.')))
    await session.prepare(plan('music'), resolver)
    expect(session.getSnapshot()).toEqual({ status: 'error', compositionKey: 'music', message: 'No se pudo cargar la pista elegida.' })
    expect(session.artifactFor('music')).toBeNull()
  })

  it('releases a renderer result whose composition does not match and surfaces the error', async () => {
    const wrong = artifact('wrong')
    const session = new FilmRenderSession(vi.fn().mockResolvedValue(wrong))
    await session.prepare(plan('expected'), resolver)
    expect(wrong.dispose).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().status).toBe('error')
  })
})

describe('Native video fullscreen', () => {
  it('calls the Safari method synchronously, preserving the original gesture', async () => {
    const native = vi.fn()
    const standard = vi.fn()
    const result = enterFilmFullscreen({ readyState: 2, webkitEnterFullscreen: native, requestFullscreen: standard } as unknown as HTMLVideoElement)
    expect(native).toHaveBeenCalledTimes(1)
    expect(standard).not.toHaveBeenCalled()
    await result
  })
  it('does not report CSS enlargement as native fullscreen or call it before video data is ready', async () => {
    const native = vi.fn()
    await expect(enterFilmFullscreen({ readyState: 1, webkitEnterFullscreen: native } as unknown as HTMLVideoElement)).rejects.toThrow('cargando')
    expect(native).not.toHaveBeenCalled()
    await expect(enterFilmFullscreen({ readyState: 4 } as HTMLVideoElement)).rejects.toThrow('no permite')
  })
})
