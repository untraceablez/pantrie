import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { login, getOAuthProviders, initiateOAuth } from '@/services/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthProviders, setOauthProviders] = useState<string[]>([])

  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuthStore()
  const { resolvedTheme } = useThemeStore()

  // Get success message from location state (e.g., from setup completion)
  const successMessage = (location.state as any)?.message

  // Fetch available OAuth providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providers = await getOAuthProviders()
        setOauthProviders(providers)
      } catch (err) {
        console.error('Failed to fetch OAuth providers:', err)
      }
    }
    fetchProviders()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await login({ email, password })
      setAuth(response.user, response.access_token, response.refresh_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    const redirectUri = `${window.location.origin}/oauth/callback`
    initiateOAuth(provider, redirectUri)
  }

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      google: 'Google',
      authentik: 'Authentik',
    }
    return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="max-w-md w-full space-y-8 bg-white/95 dark:bg-gray-800/95 p-8 rounded-lg shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex justify-center mb-6">
            <img
              src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
              alt="Pantrie Logo"
              className="h-20 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to Pantrie
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {successMessage && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {oauthProviders.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {oauthProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleOAuthLogin(provider)}
                    className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-primary"
                  >
                    <span>Sign in with {getProviderDisplayName(provider)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-primary hover:text-primary/80">
                Register here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
