import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getCurrentUser } from '@/services/auth'

export default function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract tokens from URL parameters
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        const provider = searchParams.get('provider')

        if (!accessToken || !refreshToken) {
          throw new Error('Missing authentication tokens')
        }

        // Temporarily set tokens to fetch user info
        useAuthStore.setState({
          token: accessToken,
          refreshToken: refreshToken,
        })

        // Fetch user information
        const user = await getCurrentUser()

        // Set complete auth state
        setAuth(user, accessToken, refreshToken)

        // Redirect to dashboard
        navigate('/dashboard', {
          replace: true,
          state: {
            message: `Successfully signed in with ${provider}!`,
          },
        })
      } catch (err: any) {
        console.error('OAuth callback error:', err)
        setError(err.message || 'Authentication failed')
        setLoading(false)

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', {
            replace: true,
            state: {
              error: 'OAuth authentication failed. Please try again.',
            },
          })
        }, 3000)
      }
    }

    handleOAuthCallback()
  }, [searchParams, navigate, setAuth])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 bg-white/95 dark:bg-gray-800/95 p-8 rounded-lg shadow-xl">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-4xl mb-4">✗</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 bg-white/95 dark:bg-gray-800/95 p-8 rounded-lg shadow-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Completing Sign In
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we complete your authentication...
          </p>
        </div>
      </div>
    </div>
  )
}
