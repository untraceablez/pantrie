import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import SetupPage from './SetupPage'
import { setupService } from '../services/setupService'

vi.mock('../services/setupService', () => ({
  setupService: { performInitialSetup: vi.fn() },
}))

const mockSetup = vi.mocked(setupService.performInitialSetup)

const setInput = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } })

const submitForm = (el: HTMLElement) => fireEvent.submit(el.closest('form')!)

// Fill a valid admin form and advance to the SMTP step.
const completeAdmin = () => {
  setInput('admin_email', 'admin@example.com')
  setInput('admin_username', 'admin')
  setInput('admin_password', 'Password1')
  setInput('confirm_password', 'Password1')
  setInput('household_name', 'Smiths')
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Email Setup' }))
}

describe('SetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

  it('renders the admin step first', () => {
    render(<SetupPage />)
    expect(screen.getByText("Let's get started by setting up your administrator account")).toBeInTheDocument()
    expect(screen.getByLabelText('Administrator Email')).toBeInTheDocument()
  })

  it.each([
    [{ admin_password: 'Password1', confirm_password: 'Other1234' }, 'Passwords do not match'],
    [{ admin_password: 'Pass1', confirm_password: 'Pass1' }, 'Password must be at least 8 characters long'],
    [{ admin_password: 'password1', confirm_password: 'password1' }, 'Password must contain at least one uppercase letter'],
    [{ admin_password: 'PASSWORD1', confirm_password: 'PASSWORD1' }, 'Password must contain at least one lowercase letter'],
    [{ admin_password: 'Password', confirm_password: 'Password' }, 'Password must contain at least one number'],
  ])('rejects invalid admin passwords: %o', (pw, message) => {
    render(<SetupPage />)
    setInput('admin_password', pw.admin_password)
    setInput('confirm_password', pw.confirm_password)
    // Submit directly so jsdom's minLength constraint doesn't pre-empt the JS checks.
    submitForm(document.getElementById('admin_password') as HTMLElement)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('clears the error when the admin form is edited again', () => {
    render(<SetupPage />)
    setInput('admin_password', 'Password1')
    setInput('confirm_password', 'nope')
    submitForm(document.getElementById('admin_password') as HTMLElement)
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    setInput('admin_email', 'a@b.c')
    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
  })

  it('advances through the steps with valid input', () => {
    render(<SetupPage />)
    completeAdmin()
    expect(screen.getByText('Configure email settings for user invitations (optional)')).toBeInTheDocument()
    // Step 1 now shows a check mark in the progress indicator.
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('navigates Back from SMTP to admin and Skip to notifications', () => {
    render(<SetupPage />)
    completeAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Administrator Email')).toBeInTheDocument()

    completeAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Configure notification preferences (optional)')).toBeInTheDocument()
    // Skipping SMTP surfaces the email-requires-SMTP note.
    expect(screen.getByText(/Email notifications require SMTP/)).toBeInTheDocument()
  })

  it('continues from SMTP once a host is entered, editing fields including the TLS checkbox', () => {
    render(<SetupPage />)
    completeAdmin()
    const continueBtn = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement
    expect(continueBtn.disabled).toBe(true)
    setInput('smtp_host', 'smtp.example.com')
    setInput('smtp_from_email', 'noreply@example.com')
    fireEvent.click(document.getElementById('smtp_use_tls') as HTMLInputElement) // toggle off
    expect(continueBtn.disabled).toBe(false)
    fireEvent.click(continueBtn)
    expect(screen.getByText('Configure notification preferences (optional)')).toBeInTheDocument()
  })

  it('handles the notifications step: toggles, expiry days, back and skip', () => {
    render(<SetupPage />)
    completeAdmin()
    setInput('smtp_host', 'smtp.example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Expiry-days input is shown while "expiring items" is on; toggling hides it.
    expect(document.getElementById('expiry_warning_days')).not.toBeNull()
    setInput('expiry_warning_days', '14')
    expect((document.getElementById('expiry_warning_days') as HTMLInputElement).value).toBe('14')
    setInput('expiry_warning_days', '') // parseInt('') || 7 → 7
    fireEvent.click(document.getElementById('notify_expiring_items') as HTMLInputElement)
    expect(document.getElementById('expiry_warning_days')).toBeNull()

    fireEvent.click(document.getElementById('notify_low_stock') as HTMLInputElement)
    fireEvent.click(document.getElementById('notify_new_member') as HTMLInputElement)
    fireEvent.click(document.getElementById('email_notifications_enabled') as HTMLInputElement)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(/Configure SMTP to enable/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Configure OAuth authentication (optional)')).toBeInTheDocument()
  })

  // Drive admin → SMTP(host+from) → notifications → oauth.
  const reachOAuth = () => {
    completeAdmin()
    setInput('smtp_host', 'smtp.example.com')
    setInput('smtp_from_email', 'noreply@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → notifications
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // → oauth
  }

  it('shows Google OAuth fields and submits a full Google setup', async () => {
    vi.useFakeTimers()
    mockSetup.mockResolvedValue({ message: 'ok' } as Awaited<ReturnType<typeof setupService.performInitialSetup>>)
    render(<SetupPage />)
    reachOAuth()

    fireEvent.change(document.getElementById('oauth_provider') as HTMLSelectElement, { target: { value: 'google' } })
    setInput('google_client_id', 'gid')
    setInput('google_client_secret', 'gsecret')
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }))

    await vi.waitFor(() => expect(mockSetup).toHaveBeenCalled())
    const payload = mockSetup.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({ admin_email: 'admin@example.com', household_name: 'Smiths' })
    expect(payload.smtp_config).toMatchObject({ smtp_host: 'smtp.example.com', smtp_port: 587 })
    expect(payload.notification_config).toBeDefined()
    expect(payload.oauth_config).toEqual({ google_client_id: 'gid', google_client_secret: 'gsecret' })

    // The success path redirects to /login after 1.5s.
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { href: '' } })
    await vi.advanceTimersByTimeAsync(1500)
    expect(window.location.href).toBe('/login')
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation })
  })

  it('shows Authentik OAuth fields and submits, skipping SMTP and notifications', async () => {
    vi.useFakeTimers()
    mockSetup.mockResolvedValue({ message: 'ok' } as Awaited<ReturnType<typeof setupService.performInitialSetup>>)
    render(<SetupPage />)
    completeAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })) // skip SMTP → notifications
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })) // skip notifications → oauth

    fireEvent.change(document.getElementById('oauth_provider') as HTMLSelectElement, { target: { value: 'authentik' } })
    setInput('authentik_base_url', 'https://auth.example.com')
    setInput('authentik_slug', 'pantrie')
    setInput('authentik_client_id', 'aid')
    setInput('authentik_client_secret', 'asecret')
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }))

    await vi.waitFor(() => expect(mockSetup).toHaveBeenCalled())
    const payload = mockSetup.mock.calls[0][0] as Record<string, unknown>
    expect(payload.smtp_config).toBeUndefined()
    expect(payload.notification_config).toBeUndefined()
    expect(payload.oauth_config).toMatchObject({ authentik_slug: 'pantrie', authentik_client_id: 'aid' })
  })

  it('navigates Back from OAuth to notifications', () => {
    render(<SetupPage />)
    reachOAuth()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Configure notification preferences (optional)')).toBeInTheDocument()
  })

  it('submits with no SMTP/oauth config when provider is none and host is blank', async () => {
    vi.useFakeTimers()
    mockSetup.mockResolvedValue({ message: 'ok' } as Awaited<ReturnType<typeof setupService.performInitialSetup>>)
    render(<SetupPage />)
    completeAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })) // skip SMTP
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })) // keep notifications → oauth
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }))

    await vi.waitFor(() => expect(mockSetup).toHaveBeenCalled())
    const payload = mockSetup.mock.calls[0][0] as Record<string, unknown>
    expect(payload.smtp_config).toBeUndefined()
    expect(payload.oauth_config).toBeUndefined()
    expect(payload.notification_config).toBeDefined()
  })

  it('surfaces a server error, a validation detail, then a generic fallback', async () => {
    render(<SetupPage />)
    reachOAuth()
    const complete = screen.getByRole('button', { name: 'Complete Setup' })

    mockSetup.mockRejectedValueOnce({ response: { data: { error: 'server boom' } } })
    fireEvent.click(complete)
    expect(await screen.findByText('server boom')).toBeInTheDocument()

    mockSetup.mockRejectedValueOnce({ response: { data: { details: [{ msg: 'field invalid' }] } } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }))
    expect(await screen.findByText('field invalid')).toBeInTheDocument()

    mockSetup.mockRejectedValueOnce(new Error('x'))
    fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }))
    expect(await screen.findByText('Failed to complete setup. Please try again.')).toBeInTheDocument()

    // Editing an OAuth field clears the standing error.
    fireEvent.change(document.getElementById('oauth_provider') as HTMLSelectElement, { target: { value: 'google' } })
    setInput('google_client_id', 'gid')
    expect(screen.queryByText('Failed to complete setup. Please try again.')).not.toBeInTheDocument()
  })

  it('shows step-specific footer hints', () => {
    render(<SetupPage />)
    expect(screen.getByText(/will create your administrator account/)).toBeInTheDocument()
    completeAdmin()
    expect(screen.getByText(/Email settings can be changed later/)).toBeInTheDocument()
    setInput('smtp_host', 'smtp.example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(/Notification settings can be changed later/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(/OAuth settings can be changed later/)).toBeInTheDocument()
  })

  it('keeps the OAuth provider on "none" with no extra fields by default', () => {
    render(<SetupPage />)
    reachOAuth()
    const form = screen.getByRole('button', { name: 'Complete Setup' }).closest('form')!
    expect(within(form).queryByLabelText('Google Client ID')).not.toBeInTheDocument()
    expect(within(form).queryByLabelText('Authentik Base URL')).not.toBeInTheDocument()
  })
})
