import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import EmailConfirmationPage from './EmailConfirmationPage'
import { emailService } from '@/services/email'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('@/services/email', () => ({
  emailService: { verifyToken: vi.fn(), confirmEmail: vi.fn() },
}))

const mockVerify = vi.mocked(emailService.verifyToken)
const mockConfirm = vi.mocked(emailService.confirmEmail)

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/confirm${search}`]}>
      <EmailConfirmationPage />
    </MemoryRouter>
  )

describe('EmailConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useThemeStore.setState({ resolvedTheme: 'light' })
  })
  afterEach(() => vi.useRealTimers())

  it('shows an error when no token is present', async () => {
    renderAt('')
    expect(await screen.findByText('Invalid confirmation link. No token provided.')).toBeInTheDocument()
    expect(screen.getByText('Confirmation Failed')).toBeInTheDocument()
  })

  it('shows an error when the token is invalid', async () => {
    mockVerify.mockResolvedValue({ valid: false, message: 'Token expired' })
    renderAt('?token=abc')
    expect(await screen.findByText('Token expired')).toBeInTheDocument()
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('falls back to a default message when an invalid token gives none', async () => {
    mockVerify.mockResolvedValue({ valid: false })
    renderAt('?token=abc')
    expect(await screen.findByText('Invalid or expired confirmation token.')).toBeInTheDocument()
  })

  it('confirms the email, shows user info, and redirects after 3s', async () => {
    vi.useFakeTimers()
    mockVerify.mockResolvedValue({ valid: true, user: { username: 'alice', email: 'a@b.c' } })
    mockConfirm.mockResolvedValue({ success: true, message: 'All set!' })
    renderAt('?token=good')

    await vi.waitFor(() => expect(screen.getByText('Email Confirmed!')).toBeInTheDocument())
    expect(screen.getByText('All set!')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('a@b.c')).toBeInTheDocument()

    vi.advanceTimersByTime(3000)
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { message: 'Email confirmed! You can now log in.' },
    })
  })

  it('shows an error when confirmation does not succeed', async () => {
    mockVerify.mockResolvedValue({ valid: true })
    mockConfirm.mockResolvedValue({ success: false, message: '' })
    renderAt('?token=good')
    expect(await screen.findByText('Failed to confirm email. Please try again.')).toBeInTheDocument()
  })

  it('surfaces a server error from the confirmation request', async () => {
    mockVerify.mockRejectedValue({ response: { data: { error: 'boom' } } })
    renderAt('?token=good')
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('uses the detail field, then a generic fallback, for thrown errors', async () => {
    mockVerify.mockRejectedValue({ response: { data: { detail: 'detail msg' } } })
    const { unmount } = renderAt('?token=good')
    expect(await screen.findByText('detail msg')).toBeInTheDocument()
    unmount()

    mockVerify.mockRejectedValue(new Error('x'))
    renderAt('?token=good')
    expect(await screen.findByText('An error occurred during email confirmation.')).toBeInTheDocument()
  })

  it('uses the light logo in dark mode', () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    renderAt('?token=good')
    expect((screen.getByAltText('Pantrie Logo') as HTMLImageElement).src).toContain('/pantrie-logo-light.png')
  })
})
