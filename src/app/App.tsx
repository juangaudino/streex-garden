import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { AuthPage, PasswordRecoveryPage } from '../features/auth/AuthPage'
import { CyclePage } from '../features/cycles/CyclePage'
import { PhotoGalleryPage } from '../features/cycles/PhotoGalleryPage'
import { GardenPage } from '../features/gardens/GardenPage'
import { GardensPage } from '../features/gardens/GardensPage'
import { TodayPage } from '../features/gardens/TodayPage'
import { MaintenancePage } from '../features/gardens/MaintenancePage'
import { ControlPage } from '../features/gardens/ControlPage'
import { ImportPage } from '../features/gardens/ImportPage'
import { getCurrentUser } from '../lib/garden-api'
import { getSupabaseClient, hasSupabaseConfiguration } from '../lib/supabase'

function ConfigurationRequired() {
  return (
    <main className="configuration-required">
      <p className="wordmark">Streex <span>Garden</span></p>
      <div className="configuration-card">
        <h1>La base está lista para conectarse.</h1>
        <p>Falta vincular el proyecto Supabase privado de Streex Garden. No se muestran jardines de ejemplo ni se guardan datos fuera de tu cuenta.</p>
      </div>
    </main>
  )
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfiguration)
  const [recoveringPassword, setRecoveringPassword] = useState(false)

  useEffect(() => {
    if (!hasSupabaseConfiguration()) {
      return undefined
    }
    let active = true
    void getCurrentUser().then((nextUser) => {
      if (active) setUser(nextUser)
    }).catch(() => {
      if (active) setUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      if (active) setUser(session?.user ?? null)
      if (active && event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (!hasSupabaseConfiguration()) return <ConfigurationRequired />
  if (loading) return <main className="center-state" aria-live="polite">Abriendo tu jardín…</main>
  if (recoveringPassword) return <PasswordRecoveryPage onComplete={() => setRecoveringPassword(false)} />
  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route path="/" element={<GardensPage user={user} />} />
      <Route path="/garden/:gardenId" element={<GardenPage />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/maintenance/:sessionId" element={<MaintenancePage />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/cycle/:cycleId" element={<CyclePage />} />
      <Route path="/cycle/:cycleId/photos" element={<PhotoGalleryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
