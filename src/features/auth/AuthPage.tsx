import { useState, type FormEvent } from 'react'
import { Leaf } from 'lucide-react'
import { requestPasswordRecovery, signIn, updatePassword } from '../../lib/garden-api'

export function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await signIn(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible continuar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand brand--large"><Leaf aria-hidden="true" />Streex <span>Garden</span></div>
        <h1>La historia de tus jardines, en un solo lugar.</h1>
        <p>Registra lo que ves, conserva la evidencia y vuelve a cada planta con contexto.</p>
      </section>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <h2>Bienvenido de vuelta</h2>
        <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="inline-message inline-message--error" role="alert">Error: {error}</p>}
        {notice && <p className="inline-message" role="status">{notice}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Un momento…' : 'Entrar'}</button>
        <button className="text-button" type="button" disabled={busy || !email} onClick={() => void (async () => {
          setBusy(true); setError(null); setNotice(null)
          try { await requestPasswordRecovery(email); setNotice('Si el correo tiene una cuenta, recibirás un enlace para cambiar la contraseña.') }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible solicitar la recuperación.') }
          finally { setBusy(false) }
        })()}>Olvidé mi contraseña</button>
      </form>
    </main>
  )
}

export function PasswordRecoveryPage({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return <main className="auth-page"><form className="auth-form" onSubmit={(event) => void (async () => {
    event.preventDefault(); setError(null)
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    try { await updatePassword(password); onComplete() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cambiar la contraseña.') }
    finally { setBusy(false) }
  })()}>
    <div className="brand brand--large"><Leaf aria-hidden="true" />Streex <span>Garden</span></div>
    <h2>Crea una nueva contraseña</h2>
    <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    {error && <p className="inline-message inline-message--error" role="alert">Error: {error}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
  </form></main>
}
