import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Register from './Register'
import * as authSvc from '@/services/auth'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('@/services/auth', () => ({ register: vi.fn() }))

const mockRegister = vi.mocked(authSvc.register)

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  )

const fillForm = (over: Partial<{ email: string; username: string; password: string; confirm: string }> = {}) => {
  const v = { email: 'a@b.c', username: 'alice', password: 'password1', confirm: 'password1', ...over }
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: v.email } })
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: v.username } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: v.password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: v.confirm } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Register' }))

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockRegister.mockResolvedValue({ id: 1, email: 'a@b.c' } as authSvc.User)
  })

  it('renders the registration form', () => {
    renderRegister()
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('rejects mismatched passwords', async () => {
    renderRegister()
    fillForm({ confirm: 'different1' })
    submit()
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('rejects a too-short password', async () => {
    renderRegister()
    fillForm({ password: 'short', confirm: 'short' })
    submit()
    expect(await screen.findByText('Password must be at least 8 characters long')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('registers and redirects to login with a confirmation message', async () => {
    renderRegister()
    fillForm()
    submit()
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({ email: 'a@b.c', username: 'alice', password: 'password1' })
    )
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { message: expect.stringContaining('Registration successful') },
    })
  })

  it('maps a duplicate-email detail to a friendly error', async () => {
    mockRegister.mockRejectedValue({ response: { data: { details: { email: 'taken' } } } })
    renderRegister()
    fillForm()
    submit()
    expect(await screen.findByText('This email is already registered')).toBeInTheDocument()
  })

  it('maps a duplicate-username detail to a friendly error', async () => {
    mockRegister.mockRejectedValue({ response: { data: { details: { username: 'taken' } } } })
    renderRegister()
    fillForm()
    submit()
    expect(await screen.findByText('This username is already taken')).toBeInTheDocument()
  })

  it('shows the server error message when provided', async () => {
    mockRegister.mockRejectedValue({ response: { data: { error: 'Weak password' } } })
    renderRegister()
    fillForm()
    submit()
    expect(await screen.findByText('Weak password')).toBeInTheDocument()
  })

  it('falls back to a generic message when registration fails without detail', async () => {
    mockRegister.mockRejectedValue(new Error('network'))
    renderRegister()
    fillForm()
    submit()
    expect(await screen.findByText('Registration failed. Please try again.')).toBeInTheDocument()
  })

  it('uses the light logo in dark mode', () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    renderRegister()
    expect((screen.getByAltText('Pantrie Logo') as HTMLImageElement).src).toContain('/pantrie-logo-light.png')
  })
})
