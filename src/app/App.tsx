import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { AuthPage, PasswordRecoveryPage } from '../features/auth/AuthPage'
import { CyclePage } from '../features/cycles/CyclePage'
import { PhotoGalleryPage } from '../features/cycles/PhotoGalleryPage'
import { RegisterPage } from '../features/cycles/RegisterPage'
import { GardenPage } from '../features/gardens/GardenPage'
import { GardenSystemPage } from '../features/gardens/GardenSystemPage'
import { GardensPage } from '../features/gardens/GardensPage'
import { HomePage } from '../features/gardens/HomePage'
import { TodayPage } from '../features/gardens/TodayPage'
import { MaintenancePage } from '../features/gardens/MaintenancePage'
import { ControlPage } from '../features/gardens/ControlPage'
import { ImportPage } from '../features/gardens/ImportPage'
import { GuestPlantStoryManager } from '../features/cycles/GuestPlantStoryManager'
import { GuestPlantStoryPage } from '../features/cycles/GuestPlantStoryPage'
import { GuestGardenStoryManager } from '../features/gardens/GuestGardenStoryManager'
import { GuestGardenStoryPage } from '../features/gardens/GuestGardenStoryPage'
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
  const location = useLocation()
  const guestRoute = /^\/guest\/(?:garden\/)?[^/]+$/.test(location.pathname)
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
  if (guestRoute) return <Routes><Route path="/guest/:token" element={<GuestPlantStoryPage />} /><Route path="/guest/garden/:token" element={<GuestGardenStoryPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
  if (loading) return <main className="center-state" aria-live="polite">Abriendo tu jardín…</main>
  if (recoveringPassword) return <PasswordRecoveryPage onComplete={() => setRecoveringPassword(false)} />
  if (!user) return <AuthPage />

  return (
    <Routes>
      <Route path="/" element={<HomePage user={user} />} />
      <Route path="/gardens" element={<GardensPage user={user} />} />
      <Route path="/garden/:gardenId" element={<GardenPage />} />
      <Route path="/garden/:gardenId/share" element={<GuestGardenStoryManager />} />
      <Route path="/garden/:gardenId/system" element={<GardenSystemPage />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/maintenance/:sessionId" element={<MaintenancePage />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/cycle/:cycleId" element={<CyclePage />} />
      <Route path="/cycle/:cycleId/photos" element={<PhotoGalleryPage />} />
      <Route path="/cycle/:cycleId/share" element={<GuestPlantStoryManager />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
