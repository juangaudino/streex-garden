import { Link, useLocation, useNavigate, useNavigationType, type LinkProps } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { useLayoutEffect, type MouseEvent } from 'react'

export interface PlaceContext { placeId: string; number: number; gardenId: string; cropName: string }
type ReturnPoint = { placeId: string; origin: string; scrollY: number; gardenPath: string; cyclePath: string; cycleId: string }
let returnPoint: ReturnPoint | null = null
let observedPath: string | null = null
let motionPath: string | null = null
let cancelMotion = () => {}
let motionGeneration = 0
let routeOwners = 0

function identity(point: ReturnPoint, origin: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-place-id]')).find((node) => {
    if (node.dataset.placeId !== point.placeId || node.dataset.placeOrigin !== origin) return false
    if (origin === 'profile') return node.dataset.placeCycleId === point.cycleId
    const link = node.closest('a') ?? node.closest('article')?.querySelector('a')
    return link?.getAttribute('href') === point.cyclePath
  }) ?? null
}

function waitForIdentity(point: ReturnPoint, origin: string, signal: AbortSignal): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const readyIdentity = () => {
      const node = identity(point, origin)
      return node?.closest('[aria-busy="true"]') ? null : node
    }
    const found = readyIdentity()
    if (signal.aborted || found) { resolve(signal.aborted ? null : found); return }
    const finish = (node: HTMLElement | null) => {
      observer.disconnect(); window.clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(node)
    }
    const abort = () => finish(null)
    const observer = new MutationObserver(() => { const node = readyIdentity(); if (node) finish(node) })
    const timer = window.setTimeout(() => finish(null), 5000)
    signal.addEventListener('abort', abort, { once: true })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'data-place-id', 'data-place-cycle-id'] })
  })
}

/** Only place identity is shared. Environmental photos never participate. */
async function transitionPlace(source: HTMLElement | null, point: ReturnPoint, backward: boolean, change: () => void) {
  cancelMotion()
  const generation = ++motionGeneration
  const controller = new AbortController()
  motionPath = backward ? point.gardenPath : point.cyclePath
  let cleanup = () => {}
  const cancel = () => { controller.abort(); cleanup() }
  cancelMotion = cancel
  const valid = () => !controller.signal.aborted && generation === motionGeneration && observedPath === motionPath
  const focusDestination = (target: HTMLElement | null) => {
    if (!valid() || !target?.isConnected) return
    if (backward) {
      (target.closest<HTMLElement>('a,button') ?? target.closest('article')?.querySelector<HTMLElement>('a'))?.focus({ preventScroll: true })
      // Reassert the recorded position after snapshots/layout and focus settle.
      window.scrollTo({ top: point.scrollY, behavior: 'instant' })
    }
    else target.closest('.plant-portrait')?.querySelector<HTMLElement>('.plant-identity h1')?.focus({ preventScroll: true })
  }
  const update = async () => {
    change()
    const target = await waitForIdentity(point, backward ? point.origin : 'profile', controller.signal)
    if (!valid() || !target?.isConnected) return null
    window.scrollTo({ top: backward ? point.scrollY : 0, behavior: 'instant' })
    return target
  }
  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!source?.isConnected || reduced) { focusDestination(await update()); return }
    const native = document.startViewTransition?.bind(document)
    if (native) {
      let target: HTMLElement | null = null
      source.style.viewTransitionName = 'garden-place'
      document.documentElement.dataset.placeDirection = backward ? 'back' : 'forward'
      let namesCleared = false
      cleanup = () => {
        if (namesCleared) return
        namesCleared = true
        source.style.viewTransitionName = ''
        if (target) target.style.viewTransitionName = ''
        delete document.documentElement.dataset.placeDirection
      }
      let transition: ViewTransition
      try { transition = native(async () => { target = await update(); if (target) target.style.viewTransitionName = 'garden-place' }) }
      catch { cleanup(); focusDestination(await update()); return }
      const clearNames = cleanup
      cleanup = () => { transition.skipTransition(); clearNames() }
      try { await transition.finished } catch { /* Snapshot failure does not invalidate navigation. */ }
      if (valid()) clearNames()
      focusDestination(target)
      return
    }
    const bounds = source.getBoundingClientRect()
    const clone = source.cloneNode(true) as HTMLElement
    clone.removeAttribute('data-place-id'); clone.removeAttribute('data-place-origin'); clone.removeAttribute('data-place-cycle-id')
    clone.setAttribute('aria-hidden', 'true')
    clone.classList.add('place-flight')
    Object.assign(clone.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, zIndex: '50', pointerEvents: 'none' })
    document.body.append(clone)
    cleanup = () => clone.remove()
    const target = await update()
    if (!valid() || !target) return
    // Older engines can navigate and restore focus without the decorative flight.
    if (!clone.animate) { focusDestination(target); return }
    const next = target.getBoundingClientRect()
    const previousVisibility = target.style.visibility
    const targetStyle = getComputedStyle(target)
    target.style.visibility = 'hidden'
    const flight = clone.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${next.left - bounds.left}px,${next.top - bounds.top}px) scale(${next.width / bounds.width},${next.height / bounds.height})`, backgroundColor: targetStyle.backgroundColor, borderRadius: targetStyle.borderRadius }], { duration: 360, easing: 'cubic-bezier(.22,.7,.18,1)', fill: 'forwards' })
    cleanup = () => { flight.cancel(); clone.remove(); target.style.visibility = previousVisibility }
    try { await flight.finished } catch { /* Rapid navigation cancels the previous flight. */ }
    cleanup(); focusDestination(target)
  } finally {
    cleanup(); controller.abort()
    if (generation === motionGeneration) { motionPath = null; cancelMotion = () => {} }
  }
}

// Contextual adapter only: unrelated route changes cancel its ephemeral work.
// POP restoration requires a recorded journey from this exact cycle and garden.
function usePlaceNavigation() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    ++routeOwners
    return () => {
      --routeOwners
      queueMicrotask(() => {
        if (routeOwners === 0) { cancelMotion(); ++motionGeneration; motionPath = null; returnPoint = null; observedPath = null }
      })
    }
  }, [])
  useLayoutEffect(() => {
    const previousPath = observedPath
    observedPath = pathname
    if (motionPath && motionPath !== pathname) { cancelMotion(); ++motionGeneration; motionPath = null }
    const point = returnPoint
    if (!point) return
    if (pathname !== point.gardenPath && pathname !== point.cyclePath) { returnPoint = null; return }
    if (navigationType === 'POP' && previousPath === point.cyclePath && pathname === point.gardenPath && !motionPath) {
      void transitionPlace(null, point, true, () => {})
    }
  }, [pathname, navigationType])
}

function ordinaryClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    (!event.currentTarget.target || event.currentTarget.target === '_self') && !event.currentTarget.hasAttribute('download')
}

export function PlaceLink({ place, origin = 'map', children, ...props }: LinkProps & { place: PlaceContext; origin?: string }) {
  const navigate = useNavigate()
  usePlaceNavigation()
  return <Link {...props} onClick={(event) => {
    props.onClick?.(event)
    if (event.defaultPrevented || !ordinaryClick(event)) return
    const cyclePath = typeof props.to === 'string' ? props.to.split(/[?#]/)[0] : props.to.pathname
    const cycleId = cyclePath?.match(/^\/cycle\/([^/]+)$/)?.[1]
    if (!cyclePath || !cycleId) return
    event.preventDefault()
    const point = { placeId: place.placeId, origin, scrollY: window.scrollY, gardenPath: `/garden/${place.gardenId}`, cyclePath, cycleId }
    const source = event.currentTarget.querySelector<HTMLElement>('[data-place-id]') ?? identity(point, origin)
    if (!source || observedPath !== point.gardenPath) {
      returnPoint = null
      navigate(props.to, { state: { place } })
      return
    }
    returnPoint = point
    void transitionPlace(source, point, false, () => flushSync(() => navigate(props.to, { state: { place } })))
  }}>{children}</Link>
}

export function PlaceBackLink(props: LinkProps) {
  const navigate = useNavigate()
  usePlaceNavigation()
  return <Link {...props} onClick={(event) => {
    props.onClick?.(event)
    const point = returnPoint
    if (event.defaultPrevented || !ordinaryClick(event) || !point || props.to !== point.gardenPath || observedPath !== point.cyclePath) return
    const source = identity(point, 'profile')
    if (!source) return
    event.preventDefault()
    void transitionPlace(source, point, true, () => flushSync(() => navigate(props.to)))
  }} />
}

/** Keeps the contextual adapter alive while the shell loads its next surface. */
export function PlaceNavigationOwner() { usePlaceNavigation(); return null }
