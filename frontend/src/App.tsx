import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import SetupGuard from '@/components/SetupGuard'
import SetupPage from '@/pages/SetupPage'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import EmailConfirmationPage from '@/pages/EmailConfirmationPage'
import OAuthCallback from '@/pages/OAuthCallback'
import AddItem from '@/pages/AddItem'
import Dashboard from '@/pages/Dashboard'
import Inventory from '@/pages/Inventory'
import Recipes from '@/pages/Recipes'
import Settings from '@/pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const { initializeTheme } = useThemeStore()

  useEffect(() => {
    initializeTheme()
  }, [initializeTheme])

  return (
    <BrowserRouter>
      <SetupGuard>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/confirm-email" element={<EmailConfirmationPage />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-item"
            element={
              <ProtectedRoute>
                <AddItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <ProtectedRoute>
                <Recipes />
              </ProtectedRoute>
            }
          />
          {/* The dashboard is the landing route; ProtectedRoute bounces
              unauthenticated visitors on to /login. */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </SetupGuard>
    </BrowserRouter>
  )
}

export default App
