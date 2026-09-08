import { Link, useNavigate, type LinkProps } from 'react-router-dom'
import { flushSync } from 'react-dom'
import type { MouseEvent } from 'react'

export interface PlaceContext { placeId: string; number: number; gardenId: string; cropName: string }
type ReturnPoint = { placeId: string; origin: string; scrollY: number; gardenPath: string }
let returnPoint: ReturnPoint | null = null
let cancelMotion = () => {}
let motionGeneration = 0

function identity(placeId: string, origin: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-place-id]')).find((node) => node.dataset.placeId === placeId && node.dataset.placeOrigin === origin) ?? null
}

function waitForIdentity(placeId: string, origin: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const readyIdentity = () => {
      const node = identity(placeId, origin)
      return node?.closest('[aria-busy="true"]') ? null : node
    }
    const found = readyIdentity()
    if (found) { resolve(found); return }
    const observer = new MutationObserver(() => { const node = readyIdentity(); if (node) finish(node) })
    const timer = window.setTimeout(() => finish(identity(placeId, origin)), 650)
    const finish = (node: HTMLElement | null) => { observer.disconnect(); window.clearTimeout(timer); resolve(node) }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] })
  })
}

/** Only place identity is shared. Environmental photos never participate. */
async function transitionPlace(source: HTMLElement | null, point: ReturnPoint, backward: boolean, change: () => void) {
  cancelMotion()
  const generation = ++motionGeneration
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const origin = backward ? point.origin : 'profile'
  const focusDestination = (target: HTMLElement | null) => {
    if (generation !== motionGeneration) return
    if (backward) (target?.closest<HTMLElement>('a,button') ?? target?.closest('article')?.querySelector<HTMLElement>('a'))?.focus({ preventScroll: true })
    else document.querySelector<HTMLElement>('.botanical-portrait h1')?.focus({ preventScroll: true })
  }
  const update = async () => {
    change()
    const target = await waitForIdentity(point.placeId, origin)
    if (generation !== motionGeneration) return null
    window.scrollTo({ top: backward ? point.scrollY : 0, behavior: 'instant' })
    return target
  }
  if (!source || reduced) { focusDestination(await update()); return }
  const native = document.startViewTransition?.bind(document)
  if (native) {
    let target: HTMLElement | null = null
    source.style.viewTransitionName = 'garden-place'
    document.documentElement.dataset.placeDirection = backward ? 'back' : 'forward'
    const transition = native(async () => { target = await update(); if (target) target.style.viewTransitionName = 'garden-place' })
    const cleanup = () => {
      source.style.viewTransitionName = ''
      if (target) target.style.viewTransitionName = ''
      delete document.documentElement.dataset.placeDirection
    }
    cancelMotion = () => { transition.skipTransition(); cleanup() }
    try { await transition.finished } catch { /* Navigation remains valid if snapshots are unavailable. */ }
    if (generation === motionGeneration) cleanup()
    focusDestination(target)
    return
  }
  const bounds = source.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-place-id'); clone.removeAttribute('data-place-origin')
  clone.classList.add('place-flight')
  Object.assign(clone.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, zIndex: '50', pointerEvents: 'none' })
  document.body.append(clone)
  let cancelled = false
  cancelMotion = () => { cancelled = true; clone.remove() }
  const target = await update()
  if (cancelled || !target) { clone.remove(); focusDestination(target); return }
  const next = target.getBoundingClientRect()
  const targetStyle = getComputedStyle(target)
  target.style.visibility = 'hidden'
  const flight = clone.animate([{ transform: 'translate(0,0) scale(1)', backgroundColor: getComputedStyle(source).backgroundColor }, { transform: `translate(${next.left - bounds.left}px,${next.top - bounds.top}px) scale(${next.width / bounds.width},${next.height / bounds.height})`, backgroundColor: targetStyle.backgroundColor, borderRadius: targetStyle.borderRadius }], { duration: 360, easing: 'cubic-bezier(.22,.7,.18,1)', fill: 'forwards' })
  cancelMotion = () => { flight.cancel(); clone.remove(); target.style.visibility = '' }
  try { await flight.finished } catch { /* Rapid navigation cancels the previous flight. */ }
  clone.remove(); target.style.visibility = ''; focusDestination(target)
}

function ordinaryClick(event: MouseEvent<HTMLAnchorElement>) { return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey }

export function PlaceLink({ place, origin = 'map', children, ...props }: LinkProps & { place: PlaceContext; origin?: string }) {
  const navigate = useNavigate()
  return <Link {...props} onClick={(event) => {
    props.onClick?.(event)
    if (event.defaultPrevented || !ordinaryClick(event)) return
    event.preventDefault()
    const source = event.currentTarget.querySelector<HTMLElement>('[data-place-id]') ?? identity(place.placeId, origin)
    returnPoint = { placeId: place.placeId, origin, scrollY: window.scrollY, gardenPath: `/garden/${place.gardenId}` }
    void transitionPlace(source, returnPoint, false, () => flushSync(() => navigate(props.to, { state: { place } })))
  }}>{children}</Link>
}

export function PlaceBackLink(props: LinkProps) {
  const navigate = useNavigate()
  return <Link {...props} onClick={(event) => {
    props.onClick?.(event)
    if (event.defaultPrevented || !ordinaryClick(event) || !returnPoint || props.to !== returnPoint.gardenPath) return
    const source = identity(returnPoint.placeId, 'profile')
    if (!source) return
    event.preventDefault()
    void transitionPlace(source, returnPoint, true, () => flushSync(() => navigate(props.to)))
  }} />
}

// Browser back uses the same ephemeral origin; direct entry needs no fabricated source.
window.addEventListener('popstate', () => {
  if (!returnPoint || window.location.pathname !== returnPoint.gardenPath) return
  const source = identity(returnPoint.placeId, 'profile')
  if (source) void transitionPlace(source, returnPoint, true, () => {})
})
