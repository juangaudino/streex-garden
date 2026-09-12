import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './botanical.css'

export function BotanicalButton({ secondary = false, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return <button type={type} className={`bs-button${secondary ? ' bs-button--secondary' : ''} ${className}`} {...props} />
}

/** Native modal with keyboard containment, Escape and focus restoration. */
export function BotanicalSheet({ title, context, children, onClose, busy = false, className = '' }: {
  title: string; context?: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy }, [onClose, busy])
  useEffect(() => {
    const node = ref.current!
    const trigger = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    const cancel = (event: Event) => { event.preventDefault(); if (!busyRef.current) closeRef.current() }
    node.addEventListener('cancel', cancel)
    return () => {
      node.removeEventListener('cancel', cancel)
      node.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [title])
  return <dialog ref={ref} className={`botanical-surface bs-sheet ${className}`} aria-labelledby={titleId} aria-busy={busy} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length > 0)
    const first = elements[0], last = elements.at(-1)
    if (!first || !last) { event.preventDefault(); heading.current?.focus(); return }
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === heading.current || !event.currentTarget.contains(active))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) { event.preventDefault(); first.focus() }
  }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }}>
    <div className="bs-sheet-header"><div>{context && <span className="bs-eyebrow">{context}</span>}<h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2></div><button type="button" className="bs-icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={21} aria-hidden="true" /></button></div>
    {children}
  </dialog>
}
