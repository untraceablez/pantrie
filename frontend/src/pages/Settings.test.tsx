import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Settings from './Settings'
import * as authSvc from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/auth', () => ({ logout: vi.fn() }))
vi.mock('@/components/settings/HouseholdSettings', () => ({ default: () => <div>household-panel</div> }))
vi.mock('@/components/settings/UserSettings', () => ({ default: () => <div>account-panel</div> }))
vi.mock('@/components/settings/AdministrationSettings', () => ({ default: () => <div>admin-panel</div> }))
vi.mock('@/components/settings/NotificationSettings', () => ({ default: () => <div>notifications-panel</div> }))

const mockLogout = vi.mocked(authSvc.logout)

describe('Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({ user: null, token: null, refreshToken: 'ref-123' })
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockLogout.mockResolvedValue()
  })

  it('renders the household panel by default', () => {
    render(<Settings />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('household-panel')).toBeInTheDocument()
  })

  it('switches between sections', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /Account Settings/ }))
    expect(screen.getByText('account-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Administration/ }))
    expect(screen.getByText('admin-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(screen.getByText('notifications-panel')).toBeInTheDocument()
  })

  it('navigates back to the dashboard', () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /Back to Dashboard/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('uses the light logo in dark mode', () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    render(<Settings />)
    expect((screen.getByAltText('Pantrie') as HTMLImageElement).src).toContain('/pantrie-logo-light.png')
  })

  it('logs out: calls the API with the refresh token, clears auth, and redirects', async () => {
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /Logout/ }))
    await waitFor(() => expect(mockLogout).toHaveBeenCalledWith('ref-123'))
    expect(useAuthStore.getState().user).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('skips the logout API call when there is no refresh token', async () => {
    useAuthStore.setState({ refreshToken: null })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /Logout/ }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('clears auth and redirects even when the logout API fails', async () => {
    mockLogout.mockRejectedValue(new Error('network'))
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: /Logout/ }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(console.error).toHaveBeenCalledWith('Error logging out:', expect.any(Error))
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })
})
