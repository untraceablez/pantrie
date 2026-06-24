import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Login from './Login'
import * as authSvc from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  getOAuthProviders: vi.fn(),
  initiateOAuth: vi.fn(),
}))

const mockLogin = vi.mocked(authSvc.login)
const mockProviders = vi.mocked(authSvc.getOAuthProviders)
const mockInitiate = vi.mocked(authSvc.initiateOAuth)

const renderLogin = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Login />
    </MemoryRouter>
  )

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({ user: null, token: null, refreshToken: null })
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockProviders.mockResolvedValue([])
  })

  it('renders the sign-in form', async () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Welcome to Pantrie' })).toBeInTheDocument()
    await waitFor(() => expect(mockProviders).toHaveBeenCalled())
  })

  it('shows a success message passed via router state', () => {
    renderLogin({ message: 'Account created!' })
    expect(screen.getByText('Account created!')).toBeInTheDocument()
  })

  it('logs in and redirects to the dashboard', async () => {
    mockLogin.mockResolvedValue({
      user: { id: 1, email: 'a@b.c' },
      access_token: 'acc',
      refresh_token: 'ref',
    } as authSvc.AuthResponse)
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }))
    expect(useAuthStore.getState().token).toBe('acc')
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('shows a server error on login failure', async () => {
    mockLogin.mockRejectedValue({ response: { data: { error: 'Bad creds' } } })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Bad creds')).toBeInTheDocument()
  })

  it('falls back to a generic message when login fails without detail', async () => {
    mockLogin.mockRejectedValue(new Error('network'))
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Login failed. Please try again.')).toBeInTheDocument()
  })

  it('renders OAuth provider buttons and initiates a provider login', async () => {
    mockProviders.mockResolvedValue(['google', 'authentik', 'okta'])
    renderLogin()
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Authentik' })).toBeInTheDocument()
    // Unknown providers are title-cased.
    expect(screen.getByRole('button', { name: 'Sign in with Okta' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(mockInitiate).toHaveBeenCalledWith('google', expect.stringContaining('/oauth/callback'))
  })

  it('logs an error if fetching providers fails', async () => {
    mockProviders.mockRejectedValue(new Error('down'))
    renderLogin()
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Failed to fetch OAuth providers:', expect.any(Error))
    )
    expect(screen.queryByRole('button', { name: /Sign in with/ })).not.toBeInTheDocument()
  })

  it('uses the light logo in dark mode', () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    renderLogin()
    expect((screen.getByAltText('Pantrie Logo') as HTMLImageElement).src).toContain('/pantrie-logo-light.png')
  })
})
