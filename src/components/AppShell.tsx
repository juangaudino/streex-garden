import { useEffect, useState, type PropsWithChildren } from 'react'
import { ArrowLeft, Download, House, Leaf, LogOut, MessageCircle, Plus, Sun } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '../lib/garden-api'
import { PwaUpdateNotice } from './PwaUpdateNotice'
import { PlaceBackLink } from './PlaceLink'
import { GrowthRings } from './GrowthRings'
import { clearObservationDrafts, getObservationDrafts } from '../lib/offline-observation-store'
import { downloadObservationDrafts } from '../lib/export-download'

interface AppShellProps extends PropsWithChildren {
  presentation?: 'cycle' | 'maintenance' | 'story'
  title?: string
  subtitle?: string
  backTo?: string
  actions?: React.ReactNode
}

export function AppShell({ children, title, subtitle, backTo, actions, presentation }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isCycleRoute = /^\/cycle\/[^/]+$/.test(location.pathname)
  const [showEntry, setShowEntry] = useState(() => window.sessionStorage.getItem('streex-garden-entry-seen') !== '1')
  const [pendingSignOut, setPendingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  useEffect(() => {
    if (!showEntry) return undefined
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem('streex-garden-entry-seen', '1')
      setShowEntry(false)
    }, 760)
    return () => window.clearTimeout(timer)
  }, [showEntry])
  const clearLocalGardenState = async () => {
    await clearObservationDrafts()
    Object.keys(window.localStorage).filter((key) => key.startsWith('streex-garden:')).forEach((key) => window.localStorage.removeItem(key))
  }
  const completeSignOut = async () => {
    setSigningOut(true); setSignOutError(null)
    try { await signOut(); await clearLocalGardenState(); navigate('/') }
    catch (reason) { setSignOutError(reason instanceof Error ? reason.message : 'No se pudo cerrar sesión.') }
    finally { setSigningOut(false) }
  }
  const handleSignOut = async () => {
    setSignOutError(null)
    try {
      if ((await getObservationDrafts()).length > 0) setPendingSignOut(true)
      else await completeSignOut()
    } catch (reason) { setSignOutError(reason instanceof Error ? reason.message : 'No se pudieron revisar los borradores locales.') }
  }
  const exportDraftsThenSignOut = async () => {
    setSigningOut(true); setSignOutError(null)
    try { await downloadObservationDrafts(await getObservationDrafts()); await completeSignOut() }
    catch (reason) { setSignOutError(reason instanceof Error ? reason.message : 'No se pudieron exportar los borradores.') ; setSigningOut(false) }
  }
  const openCycleRegister = () => {
    const target = document.getElementById('cycle-observation')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    target?.querySelector<HTMLElement>('textarea, input, button')?.focus({ preventScroll: true })
  }
  return (
    <div className={`app-shell app-shell--${location.pathname === '/' ? 'home' : 'detail'}${presentation ? ` app-shell--${presentation}` : ''}`}>
      {showEntry && <div className="app-entry" aria-hidden="true"><GrowthRings /><img className="app-entry__logo" src="/brand/garden-x-logo.png" alt="" /></div>}
      {pendingSignOut && <section className="signout-dialog" role="dialog" aria-modal="true" aria-labelledby="signout-title"><div className="signout-dialog__panel"><h2 id="signout-title">Hay borradores pendientes</h2><p>Antes de cerrar sesión, sincronízalos desde su ciclo, expórtalos en este dispositivo o descártalos. Al salir se borra el almacenamiento local para que otra cuenta no pueda verlos.</p>{signOutError && <p className="inline-message inline-message--error" role="alert">{signOutError}</p>}<div className="button-row"><button className="secondary-button" type="button" disabled={signingOut} onClick={() => setPendingSignOut(false)}>Volver a sincronizar</button><button className="secondary-button" type="button" disabled={signingOut} onClick={() => void exportDraftsThenSignOut()}><Download size={16} aria-hidden="true" /> Exportar y cerrar</button><button className="primary-button" type="button" disabled={signingOut} onClick={() => void completeSignOut()}>{signingOut ? 'Cerrando…' : 'Descartar y cerrar'}</button></div></div></section>}
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Ir a Home"><span>Garden</span><img className="brand__mark" src="/brand/garden-x-mark.png" alt="" /></Link>
        <nav className="topbar__nav" aria-label="Navegación principal"><Link className={location.pathname === '/' ? 'topbar__nav-link topbar__nav-link--active' : 'topbar__nav-link'} to="/">Home</Link><Link className={location.pathname.startsWith('/garden') || location.pathname === '/gardens' ? 'topbar__nav-link topbar__nav-link--active' : 'topbar__nav-link'} to="/gardens">Jardines</Link><Link className={location.pathname === '/today' ? 'topbar__nav-link topbar__nav-link--active' : 'topbar__nav-link'} to="/today">Hoy</Link><Link className={location.pathname === '/ask-garden' ? 'topbar__nav-link topbar__nav-link--active' : 'topbar__nav-link'} to="/ask-garden">Ask Garden</Link></nav>
        <div className="topbar__actions">{isCycleRoute ? <button className="topbar__register" type="button" onClick={openCycleRegister}><Plus size={16} aria-hidden="true" /> Registrar</button> : <Link className="topbar__register" to="/register"><Plus size={16} aria-hidden="true" /> Registrar</Link>}<button className="icon-button" type="button" disabled={signingOut} onClick={() => void handleSignOut()} aria-label="Cerrar sesión"><LogOut size={18} aria-hidden="true" /></button></div>
      </header>
      {(title || backTo || actions) && (
        <section className="page-heading">
          <div className="heading-copy">
            {backTo && <PlaceBackLink className="back-link" to={backTo}><ArrowLeft size={16} aria-hidden="true" /> Volver</PlaceBackLink>}
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="heading-actions">{actions}</div>}
        </section>
      )}
      <main className="page-content">{children}</main>
      <PwaUpdateNotice />
      <nav className="bottom-nav" aria-label="Navegación principal">
        <Link to="/" className={`bottom-nav__item${location.pathname === '/' ? ' bottom-nav__item--active' : ''}`}><House size={18} aria-hidden="true" />Home</Link>
        <Link to="/gardens" className={`bottom-nav__item${location.pathname === '/gardens' || location.pathname.startsWith('/garden/') ? ' bottom-nav__item--active' : ''}`}><Leaf size={18} aria-hidden="true" />Jardines</Link>
        <Link to="/today" className={`bottom-nav__item${location.pathname === '/today' ? ' bottom-nav__item--active' : ''}`}><Sun size={18} aria-hidden="true" />Hoy</Link>
        <Link to="/ask-garden" className={`bottom-nav__item${location.pathname === '/ask-garden' ? ' bottom-nav__item--active' : ''}`}><MessageCircle size={18} aria-hidden="true" />Ask Garden</Link>
      </nav>
    </div>
  )
}
