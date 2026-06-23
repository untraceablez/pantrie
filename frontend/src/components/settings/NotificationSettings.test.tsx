import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotificationSettings from './NotificationSettings'
import { useAuthStore } from '@/store/authStore'

vi.mock('@/components/settings/EmailNotificationSettings', () => ({
  default: () => <div>EMAIL PANEL</div>,
}))
vi.mock('@/components/settings/WebhookSettings', () => ({
  default: () => <div>WEBHOOK PANEL</div>,
}))

const setUser = (site_role: string | null) =>
  useAuthStore.setState({
    user: site_role ? ({ id: 1, site_role } as never) : null,
    isAuthenticated: !!site_role,
  })

describe('NotificationSettings', () => {
  beforeEach(() => setUser(null))

  it('blocks non-site-admins', () => {
    setUser('user')
    render(<NotificationSettings />)
    expect(
      screen.getByText('You need site administrator privileges to access notification settings.')
    ).toBeInTheDocument()
  })

  it('blocks when there is no user', () => {
    render(<NotificationSettings />)
    expect(
      screen.getByText('You need site administrator privileges to access notification settings.')
    ).toBeInTheDocument()
  })

  it('renders tabs for site admins and switches between them', () => {
    setUser('site_administrator')
    render(<NotificationSettings />)

    expect(screen.getByText('Notification Settings')).toBeInTheDocument()
    // Email tab is active by default
    expect(screen.getByText('EMAIL PANEL')).toBeInTheDocument()
    expect(screen.queryByText('WEBHOOK PANEL')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Webhooks'))
    expect(screen.getByText('WEBHOOK PANEL')).toBeInTheDocument()
    expect(screen.queryByText('EMAIL PANEL')).not.toBeInTheDocument()
  })
})
