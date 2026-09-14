import type { ReactNode } from 'react'
import { AlertTriangle, Leaf, LoaderCircle, RefreshCw } from 'lucide-react'

interface StatePanelProps {
  kind: 'empty' | 'error' | 'loading'
  title?: string
  children?: ReactNode
  onRetry?: () => void
}

export function StatePanel({ kind, title, children, onRetry }: StatePanelProps) {
  const icon = kind === 'error'
    ? <AlertTriangle aria-hidden="true" />
    : kind === 'loading'
      ? <LoaderCircle aria-hidden="true" />
      : <Leaf aria-hidden="true" />
  return (
    <section
      className={`state-panel state-panel--${kind}`}
      role={kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined}
      aria-busy={kind === 'loading' ? true : undefined}
    >
      {icon}
      <div>
        <h2>{title ?? (kind === 'loading' ? 'Cargando…' : 'No hay nada aquí todavía')}</h2>
        {children && <p>{children}</p>}
        {onRetry && <button className="text-button" type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button>}
      </div>
    </section>
  )
}
