import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { useAuthStore } from '@/store/authStore'

// initializeTheme is asserted; the real themeStore touches localStorage/matchMedia.
const initializeTheme = vi.fn()
vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ initializeTheme }),
}))

// SetupGuard has its own suite; here it's a passthrough so routing is what we test.
vi.mock('@/components/SetupGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Each page is stubbed to a marker so we can assert which route rendered.
vi.mock('@/pages/SetupPage', () => ({ default: () => <div>SETUP PAGE</div> }))
vi.mock('@/pages/Login', () => ({ default: () => <div>LOGIN PAGE</div> }))
vi.mock('@/pages/Register', () => ({ default: () => <div>REGISTER PAGE</div> }))
vi.mock('@/pages/EmailConfirmationPage', () => ({
  default: () => <div>EMAIL CONFIRM PAGE</div>,
}))
vi.mock('@/pages/OAuthCallback', () => ({ default: () => <div>OAUTH CALLBACK PAGE</div> }))
vi.mock('@/pages/AddItem', () => ({ default: () => <div>ADD ITEM PAGE</div> }))
vi.mock('@/pages/Inventory', () => ({ default: () => <div>INVENTORY PAGE</div> }))
vi.mock('@/pages/Recipes', () => ({ default: () => <div>RECIPES PAGE</div> }))
vi.mock('@/pages/Settings', () => ({ default: () => <div>SETTINGS PAGE</div> }))

const renderAt = (path: string, authenticated = false) => {
  useAuthStore.setState({ isAuthenticated: authenticated } as never)
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ isAuthenticated: false } as never)
  })

  it('initializes the theme on mount', () => {
    renderAt('/login')
    expect(initializeTheme).toHaveBeenCalledTimes(1)
  })

  it('renders the login page at /login', () => {
    renderAt('/login')
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })

  it('renders the register page at /register', () => {
    renderAt('/register')
    expect(screen.getByText('REGISTER PAGE')).toBeInTheDocument()
  })

  it('renders the setup page at /setup', () => {
    renderAt('/setup')
    expect(screen.getByText('SETUP PAGE')).toBeInTheDocument()
  })

  it('renders the email-confirmation page at /confirm-email', () => {
    renderAt('/confirm-email')
    expect(screen.getByText('EMAIL CONFIRM PAGE')).toBeInTheDocument()
  })

  it('renders the OAuth callback page at /oauth/callback', () => {
    renderAt('/oauth/callback')
    expect(screen.getByText('OAUTH CALLBACK PAGE')).toBeInTheDocument()
  })

  it('redirects the index route to /login', () => {
    renderAt('/')
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })

  describe('protected routes', () => {
    it('renders the dashboard when authenticated', () => {
      renderAt('/dashboard', true)
      expect(screen.getByText('INVENTORY PAGE')).toBeInTheDocument()
    })

    it('renders add-item when authenticated', () => {
      renderAt('/add-item', true)
      expect(screen.getByText('ADD ITEM PAGE')).toBeInTheDocument()
    })

    it('renders settings when authenticated', () => {
      renderAt('/settings', true)
      expect(screen.getByText('SETTINGS PAGE')).toBeInTheDocument()
    })

    it('renders recipes when authenticated', () => {
      renderAt('/recipes', true)
      expect(screen.getByText('RECIPES PAGE')).toBeInTheDocument()
    })

    it('redirects to /login when unauthenticated', () => {
      renderAt('/dashboard', false)
      expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
    })
  })
})
