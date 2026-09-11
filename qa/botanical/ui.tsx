import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Check, ImageOff, Leaf, X } from 'lucide-react'
import type { Scenario } from './model'

export function IconButton({ label, children, onClick, className = '', disabled = false }: { label: string; children: ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Button({ children, onClick, secondary = false, disabled = false, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return <button type={type} className={`button ${secondary ? 'button--secondary' : ''} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function Dialog({ title, eyebrow, children, onClose, wide = false, dark = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean; dark?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const node = ref.current!
    const active = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    const cancel = (event: Event) => { event.preventDefault(); onCloseRef.current() }
    node.addEventListener('cancel', cancel)
    return () => { node.removeEventListener('cancel', cancel); node.close(); document.body.style.overflow = overflow; active?.focus() }
  }, [])
  return <dialog ref={ref} className={`sheet ${wide ? 'sheet--wide' : ''} ${dark ? 'sheet--dark' : ''}`} aria-labelledby="sheet-title" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="sheet-inner"><div className="sheet-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id="sheet-title">{title}</h2></div><IconButton label="Cerrar" onClick={onClose}><X size={21} /></IconButton></div>{children}</div>
  </dialog>
}

export function Photo({ src, alt, className = '', onClick, scenario = 'normal' }: { src: string; alt: string; className?: string; onClick?: () => void; scenario?: Scenario }) {
  if (scenario === 'loading') return <div className={`photo-placeholder skeleton ${className}`} role="status"><span>Cargando fotografía…</span></div>
  if (scenario === 'empty' || scenario === 'error') return <div className={`photo-placeholder ${className}`}><ImageOff size={30} strokeWidth={1.3} /><span>{scenario === 'empty' ? 'Su historia está por empezar' : 'La fotografía no está disponible'}</span></div>
  const img = <img src={src} alt={alt} decoding="async" onError={e => { e.currentTarget.style.visibility = 'hidden'; e.currentTarget.parentElement?.classList.add('photo-failed') }} />
  return onClick ? <button type="button" className={`photo ${className}`} onClick={onClick} aria-label={`Ampliar: ${alt}`}>{img}</button> : <div className={`photo ${className}`}>{img}</div>
}

export function EmptyState({ title, description, action, onAction, error = false }: { title: string; description: string; action: string; onAction: () => void; error?: boolean }) {
  return <section className="empty-state" role={error ? 'alert' : undefined}>{error ? <AlertCircle size={32} strokeWidth={1.3} /> : <Leaf size={36} strokeWidth={1.2} />}<h2>{title}</h2><p>{description}</p><Button onClick={onAction}>{action}<ArrowRight size={17} /></Button></section>
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? 'notice--error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <AlertCircle size={18} /> : <Check size={18} />}<span>{children}</span></div>
}

export function Breadcrumb({ onBack, title, detail }: { onBack: () => void; title: string; detail?: string }) {
  return <div className="breadcrumb"><button type="button" onClick={onBack}><ArrowLeft size={17} />{title}</button>{detail && <><span className="breadcrumb-divider">/</span><span>{detail}</span></>}</div>
}

export function PhotoCaption({ date = 'Fecha de captura sin confirmar', children }: { date?: string; children?: ReactNode }) {
  return <div className="photo-caption"><Camera size={14} /><span>{date}</span>{children}</div>
}
