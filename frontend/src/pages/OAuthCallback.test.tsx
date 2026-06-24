import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import OAuthCallback from './OAuthCallback'
import * as authSvc from '@/services/auth'
import { useAuthStore } from '@/store/authStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('@/services/auth', () => ({ getCurrentUser: vi.fn() }))

const mockGetUser = vi.mocked(authSvc.getCurrentUser)

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <OAuthCallback />
    </MemoryRouter>
  )

describe('OAuthCallback page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({ user: null, token: null, refreshToken: null })
  })
  afterEach(() => vi.useRealTimers())

  it('completes sign-in and redirects to the dashboard', async () => {
    mockGetUser.mockResolvedValue({ id: 1, email: 'a@b.c' } as authSvc.User)
    renderAt('?access_token=acc&refresh_token=ref&provider=google')

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockGetUser).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
      replace: true,
      state: { message: 'Successfully signed in with google!' },
    })
    // Auth state was populated.
    expect(useAuthStore.getState().token).toBe('acc')
    expect(useAuthStore.getState().user).toEqual({ id: 1, email: 'a@b.c' })
  })

  it('shows an error and redirects to login when tokens are missing', async () => {
    vi.useFakeTimers()
    renderAt('?provider=google')

    await vi.waitFor(() => expect(screen.getByText('Authentication Failed')).toBeInTheDocument())
    expect(screen.getByText('Missing authentication tokens')).toBeInTheDocument()
    expect(mockGetUser).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { error: 'OAuth authentication failed. Please try again.' },
    })
  })

  it('shows an error when fetching the user fails', async () => {
    mockGetUser.mockRejectedValue(new Error('user fetch failed'))
    renderAt('?access_token=acc&refresh_token=ref&provider=github')
    expect(await screen.findByText('user fetch failed')).toBeInTheDocument()
    expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
  })

  it('falls back to a generic message when the error has none', async () => {
    mockGetUser.mockRejectedValue({})
    renderAt('?access_token=acc&refresh_token=ref&provider=github')
    expect(await screen.findByText('Authentication failed')).toBeInTheDocument()
  })

  it('shows the loading spinner state initially', () => {
    mockGetUser.mockReturnValue(new Promise(() => {})) // never resolves
    renderAt('?access_token=acc&refresh_token=ref&provider=google')
    expect(screen.getByText('Completing Sign In')).toBeInTheDocument()
  })
})
