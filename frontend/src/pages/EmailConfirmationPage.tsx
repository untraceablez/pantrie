import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { emailService } from '@/services/email'

export default function EmailConfirmationPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [userInfo, setUserInfo] = useState<{ username: string; email: string } | null>(null)
  const navigate = useNavigate()
  const { resolvedTheme } = useThemeStore()

  const token = searchParams.get('token')

  useEffect(() => {
    let isCancelled = false

    const confirmEmail = async () => {
      if (!token) {
        if (!isCancelled) {
          setStatus('error')
          setMessage('Invalid confirmation link. No token provided.')
        }
        return
      }

      try {
        // First verify the token is valid
        const verifyResult = await emailService.verifyToken(token)

        if (isCancelled) return

        if (!verifyResult.valid) {
          setStatus('error')
          setMessage(verifyResult.message || 'Invalid or expired confirmation token.')
          return
        }

        setUserInfo(verifyResult.user || null)

        // Now confirm the email
        const confirmResult = await emailService.confirmEmail(token)

        if (isCancelled) return

        if (confirmResult.success) {
          setStatus('success')
          setMessage(confirmResult.message)

          // Redirect to login after 3 seconds
          setTimeout(() => {
            if (!isCancelled) {
              navigate('/login', {
                state: { message: 'Email confirmed! You can now log in.' }
              })
            }
          }, 3000)
        } else {
          setStatus('error')
          setMessage('Failed to confirm email. Please try again.')
        }
      } catch (err: any) {
        if (!isCancelled) {
          setStatus('error')
          const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'An error occurred during email confirmation.'
          setMessage(errorMessage)
        }
      }
    }

    confirmEmail()

    return () => {
      isCancelled = true
    }
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <img
              src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
              alt="Pantrie Logo"
              className="h-16 w-auto"
            />
          </div>

          {status === 'loading' && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Confirming your email...
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Confirmed!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {message}
              </p>
              {userInfo && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Username:</span> {userInfo.username}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Email:</span> {userInfo.email}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting to login page in 3 seconds...
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-primary"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Confirmation Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-primary"
                >
                  Go to Login
                </Link>
                <Link
                  to="/register"
                  className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-primary"
                >
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
