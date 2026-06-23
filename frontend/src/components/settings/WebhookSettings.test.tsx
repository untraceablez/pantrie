import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WebhookSettings from './WebhookSettings'
import { notificationService } from '@/services/notifications'

vi.mock('@/services/notifications', () => ({
  notificationService: {
    listWebhooks: vi.fn(),
    createWebhook: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    testWebhook: vi.fn(),
  },
}))

const mockList = vi.mocked(notificationService.listWebhooks)
const mockCreate = vi.mocked(notificationService.createWebhook)
const mockUpdate = vi.mocked(notificationService.updateWebhook)
const mockDelete = vi.mocked(notificationService.deleteWebhook)
const mockTest = vi.mocked(notificationService.testWebhook)

const webhook = (over = {}) => ({
  id: 1,
  name: 'Slack',
  url: 'https://hooks.slack.com/x',
  is_active: true,
  event_types: ['low_stock'],
  household_id: null,
  created_by_id: 1,
  ...over,
})

describe('WebhookSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the empty state', async () => {
    mockList.mockResolvedValue([])
    render(<WebhookSettings />)
    expect(await screen.findByText('No webhooks configured yet.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    mockList.mockRejectedValue({ response: { data: { detail: 'load fail' } } })
    render(<WebhookSettings />)
    expect(await screen.findByText('load fail')).toBeInTheDocument()
  })

  it('renders existing webhooks with status and event labels', async () => {
    mockList.mockResolvedValue([webhook(), webhook({ id: 2, name: 'Off', is_active: false })])
    render(<WebhookSettings />)
    expect(await screen.findByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getAllByText('Low Stock').length).toBeGreaterThan(0) // event label
  })

  it('creates a webhook', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(webhook())
    render(<WebhookSettings />)
    await screen.findByText('No webhooks configured yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add Webhook' }))
    expect(screen.getByText('Add Webhook', { selector: 'h3' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('My Webhook'), { target: { value: 'New' } })
    fireEvent.change(screen.getByPlaceholderText('https://example.com/webhook'), {
      target: { value: 'https://h' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', url: 'https://h' }))
    )
    expect(await screen.findByText('Webhook created successfully')).toBeInTheDocument()
  })

  it('disables Create when no event types are selected', async () => {
    mockList.mockResolvedValue([])
    render(<WebhookSettings />)
    await screen.findByText('No webhooks configured yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add Webhook' }))
    // Three event types are checked by default; uncheck all (exercises the filter branch).
    const checks = screen.getAllByRole('checkbox')
    checks.forEach((c) => fireEvent.click(c))
    expect((screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(true)

    // Re-check one (exercises the add branch) -> Create re-enabled.
    fireEvent.click(checks[0])
    expect((screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('edits a webhook (including the secret) and reloads', async () => {
    mockList.mockResolvedValue([webhook()])
    mockUpdate.mockResolvedValue(webhook({ name: 'Renamed' }))
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Webhook')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('My Webhook'), { target: { value: 'Renamed' } })
    fireEvent.change(screen.getByPlaceholderText('(unchanged)'), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Renamed', secret: 's3cret' }))
    )
    expect(await screen.findByText('Webhook updated successfully')).toBeInTheDocument()
  })

  it('surfaces a save error (with fallback)', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValueOnce(new Error('network'))
    render(<WebhookSettings />)
    await screen.findByText('No webhooks configured yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add Webhook' }))
    fireEvent.change(screen.getByPlaceholderText('My Webhook'), { target: { value: 'N' } })
    fireEvent.change(screen.getByPlaceholderText('https://example.com/webhook'), {
      target: { value: 'https://h' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Failed to save webhook')).toBeInTheDocument()
  })

  it('toggles active state', async () => {
    mockList.mockResolvedValue([webhook()])
    mockUpdate.mockResolvedValue(webhook({ is_active: false }))
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, { is_active: false }))
  })

  it('surfaces a toggle-active error', async () => {
    mockList.mockResolvedValue([webhook()])
    mockUpdate.mockRejectedValue({ response: { data: { detail: 'toggle fail' } } })
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(await screen.findByText('toggle fail')).toBeInTheDocument()
  })

  it('surfaces a delete error (with fallback)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([webhook()])
    mockDelete.mockRejectedValue(new Error('network'))
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Failed to delete webhook')).toBeInTheDocument()
  })

  it('deletes after confirmation, and not when cancelled', async () => {
    mockList.mockResolvedValue([webhook()])
    mockDelete.mockResolvedValue()

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Webhook deleted successfully')).toBeInTheDocument()
  })

  it('tests a webhook and shows the result (success then error)', async () => {
    mockList.mockResolvedValue([webhook()])
    mockTest.mockResolvedValueOnce({ success: true, message: 'pinged ok' })
    render(<WebhookSettings />)
    await screen.findByText('Slack')

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(await screen.findByText('pinged ok')).toBeInTheDocument()

    mockTest.mockRejectedValueOnce({ response: { data: { detail: 'test failed' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(await screen.findByText('test failed')).toBeInTheDocument()
  })

  it('closes the modal via Cancel', async () => {
    mockList.mockResolvedValue([])
    render(<WebhookSettings />)
    await screen.findByText('No webhooks configured yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Add Webhook' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Edit Webhook')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('My Webhook')).not.toBeInTheDocument()
  })
})
