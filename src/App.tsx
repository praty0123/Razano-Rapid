import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'sonner'
import { SessionProvider, useSession } from './lib/session'
import { UIProvider } from './components/AppShell'
import { SUPABASE_URL } from './lib/config'
import Book from './pages/Book'
import Track from './pages/Track'
import Records from './pages/Records'
const Visit = lazy(() => import('./pages/Visit'))
const Nurse = lazy(() => import('./pages/Nurse'))
const Admin = lazy(() => import('./pages/Admin'))
const Account = lazy(() => import('./pages/Account'))
const Privacy = lazy(() => import('./pages/Privacy'))
const NurseHistory = lazy(() => import('./pages/NurseHistory'))

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/** Nurses never see the family booking app. */
function FamilyOnly({ children }: { children: React.ReactElement }) {
  const { user } = useSession()
  if (user?.role === 'nurse') return <Navigate to="/nurse" replace />
  return children
}

export default function App() {
  if (!SUPABASE_URL) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Setup needed: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).</div>
  }
  return (
    <BrowserRouter>
      <SessionProvider>
        <UIProvider>
          <ScrollTop />
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<FamilyOnly><Book /></FamilyOnly>} />
            <Route path="/track" element={<FamilyOnly><Track /></FamilyOnly>} />
            <Route path="/track/:id" element={<FamilyOnly><Track /></FamilyOnly>} />
            <Route path="/records" element={<FamilyOnly><Records /></FamilyOnly>} />
            <Route path="/visit/:id" element={<FamilyOnly><Visit /></FamilyOnly>} />
            <Route path="/nurse" element={<Nurse />} />
            <Route path="/nurse/history" element={<NurseHistory />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/account" element={<Account />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<FamilyOnly><Book /></FamilyOnly>} />
          </Routes>
          </Suspense>
          <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Manrope, sans-serif' } }} />
        </UIProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
