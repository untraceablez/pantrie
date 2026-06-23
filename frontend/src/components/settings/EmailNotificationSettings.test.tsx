import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EmailNotificationSettings from './EmailNotificationSettings'
import { notificationService } from '@/services/notifications'

vi.mock('@/services/notifications', () => ({
  notificationService: {
    getEmailSettings: vi.fn(),
    updateEmailSettings: vi.fn(),
  },
}))

const mockGet = vi.mocked(notificationService.getEmailSettings)
const mockUpdate = vi.mocked(notificationService.updateEmailSettings)

const settings = (over = {}) => ({
  email_notifications_enabled: false,
  notify_expiring_items: true,
  notify_low_stock: true,
  notify_new_member: true,
  expiry_warning_days: 7,
  smtp_configured: true,
  ...over,
})

describe('EmailNotificationSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and renders the form', async () => {
    mockGet.mockResolvedValue(settings())
    render(<EmailNotificationSettings />)
    expect(await screen.findByText('Enable Email Notifications')).toBeInTheDocument()
    expect(screen.getByText('Notification Events')).toBeInTheDocument()
  })

  it('shows a failure message when loading fails', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(<EmailNotificationSettings />)
    expect(await screen.findByText('Failed to load settings')).toBeInTheDocument()
  })

  it('warns and disables the master toggle when SMTP is not configured', async () => {
    mockGet.mockResolvedValue(settings({ smtp_configured: false }))
    render(<EmailNotificationSettings />)
    expect(await screen.findByText('SMTP Not Configured')).toBeInTheDocument()

    const masterToggle = screen.getAllByRole('checkbox')[0] as HTMLInputElement
    expect(masterToggle.disabled).toBe(true)
  })

  it('hides the expiry-days input when expiring-items is off, shows it when on', async () => {
    mockGet.mockResolvedValue(settings({ notify_expiring_items: false }))
    render(<EmailNotificationSettings />)
    await screen.findByText('Enable Email Notifications')
    expect(screen.queryByText('Days before expiry to send warning')).not.toBeInTheDocument()

    // Toggle expiring-items on (it's the 2nd checkbox).
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByText('Days before expiry to send warning')).toBeInTheDocument()

    // And tweak the day count.
    const days = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(days, { target: { value: '14' } })
    expect(days.value).toBe('14')
  })

  it('saves settings and shows a success message', async () => {
    mockGet.mockResolvedValue(settings())
    mockUpdate.mockResolvedValue(settings({ email_notifications_enabled: true }))
    render(<EmailNotificationSettings />)
    await screen.findByText('Enable Email Notifications')

    fireEvent.click(screen.getAllByRole('checkbox')[0]) // enable master toggle
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ email_notifications_enabled: true })
      )
    )
    expect(
      await screen.findByText('Email notification settings saved successfully')
    ).toBeInTheDocument()
  })

  it('toggles each notification event and persists them', async () => {
    mockGet.mockResolvedValue(settings())
    mockUpdate.mockResolvedValue(settings())
    render(<EmailNotificationSettings />)
    await screen.findByText('Enable Email Notifications')

    const checks = screen.getAllByRole('checkbox')
    // [0]=master, [1]=expiring, [2]=low stock, [3]=new member
    fireEvent.click(checks[2]) // low stock -> off
    fireEvent.click(checks[3]) // new member -> off
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ notify_low_stock: false, notify_new_member: false })
      )
    )
  })

  it('surfaces a save error (detail + fallback)', async () => {
    mockGet.mockResolvedValue(settings())
    mockUpdate.mockRejectedValueOnce({ response: { data: { detail: 'server boom' } } })
    render(<EmailNotificationSettings />)
    await screen.findByText('Enable Email Notifications')

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('server boom')).toBeInTheDocument()

    mockUpdate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('Failed to save settings')).toBeInTheDocument()
  })
})
