import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SiteSettings from './SiteSettings'
import { siteSettingsService } from '@/services/siteSettings'

vi.mock('@/services/siteSettings', () => ({
  siteSettingsService: {
    getSMTPSettings: vi.fn(),
    updateSMTPSettings: vi.fn(),
  },
}))

const mockGet = vi.mocked(siteSettingsService.getSMTPSettings)
const mockUpdate = vi.mocked(siteSettingsService.updateSMTPSettings)

const smtp = (over = {}) => ({
  smtp_host: 'smtp.example.com',
  smtp_port: 587,
  smtp_user: 'user',
  smtp_from_email: 'noreply@example.com',
  smtp_from_name: 'Pantrie',
  smtp_use_tls: true,
  require_email_confirmation: true,
  ...over,
})

describe('SiteSettings (SMTP)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and prefills the form', async () => {
    mockGet.mockResolvedValue(smtp())
    render(<SiteSettings />)
    expect(await screen.findByDisplayValue('smtp.example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('noreply@example.com')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(<SiteSettings />)
    expect(await screen.findByText('Failed to load SMTP settings')).toBeInTheDocument()
  })

  it('validates required host/from-email', async () => {
    mockGet.mockResolvedValue(smtp({ smtp_host: null, smtp_from_email: null }))
    const { container } = render(<SiteSettings />)
    await screen.findByText('SMTP Settings')

    // Submit the form directly (bypasses the inputs' `required` so the handler runs).
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText('SMTP host and from email are required')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('saves settings and reloads', async () => {
    mockGet.mockResolvedValue(smtp())
    mockUpdate.mockResolvedValue(smtp())
    render(<SiteSettings />)
    await screen.findByDisplayValue('smtp.example.com')

    fireEvent.change(screen.getByLabelText(/SMTP Host/i), { target: { value: 'smtp.new' } })
    fireEvent.click(screen.getByLabelText(/Use TLS encryption/i)) // toggle a checkbox
    fireEvent.click(screen.getByLabelText(/Require email confirmation/i))
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ smtp_host: 'smtp.new' }))
    )
    expect(await screen.findByText('SMTP settings updated successfully')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('edits every field and persists the values', async () => {
    mockGet.mockResolvedValue(smtp())
    mockUpdate.mockResolvedValue(smtp())
    render(<SiteSettings />)
    await screen.findByDisplayValue('smtp.example.com')

    fireEvent.change(screen.getByLabelText(/SMTP Host/i), { target: { value: 'h.new' } })
    fireEvent.change(screen.getByLabelText(/SMTP Port/i), { target: { value: '2525' } })
    fireEvent.change(screen.getByLabelText(/SMTP Username/i), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByLabelText(/SMTP Password/i), { target: { value: 'pw' } })
    fireEvent.change(screen.getByLabelText(/From Email/i), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(/From Name/i), { target: { value: 'Custom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          smtp_host: 'h.new',
          smtp_port: 2525,
          smtp_user: 'newuser',
          smtp_password: 'pw',
          smtp_from_email: 'a@b.c',
          smtp_from_name: 'Custom',
        })
      )
    )
  })

  it('surfaces a save error (detail + fallback)', async () => {
    mockGet.mockResolvedValue(smtp())
    mockUpdate.mockRejectedValueOnce({ response: { data: { detail: 'smtp boom' } } })
    render(<SiteSettings />)
    await screen.findByDisplayValue('smtp.example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('smtp boom')).toBeInTheDocument()

    mockUpdate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('Failed to update SMTP settings')).toBeInTheDocument()
  })
})
