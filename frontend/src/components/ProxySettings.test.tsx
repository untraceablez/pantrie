import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProxySettings from './ProxySettings'
import { siteSettingsService } from '@/services/siteSettings'

vi.mock('@/services/siteSettings', () => ({
  siteSettingsService: {
    getProxySettings: vi.fn(),
    updateProxySettings: vi.fn(),
  },
}))

const mockGet = vi.mocked(siteSettingsService.getProxySettings)
const mockUpdate = vi.mocked(siteSettingsService.updateProxySettings)

const proxy = (over = {}) => ({
  proxy_mode: 'none',
  external_proxy_url: null,
  custom_domain: null,
  use_https: true,
  ...over,
})

describe('ProxySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders "none" mode without the conditional fields', async () => {
    mockGet.mockResolvedValue(proxy())
    render(<ProxySettings />)
    expect(await screen.findByText('Reverse Proxy Configuration')).toBeInTheDocument()
    expect(screen.getByText(/Direct access mode/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Custom Domain')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Use HTTPS/)).not.toBeInTheDocument()
  })

  it('renders external mode with proxy URL, custom domain and HTTPS toggle', async () => {
    mockGet.mockResolvedValue(
      proxy({ proxy_mode: 'external', external_proxy_url: 'http://10.0.0.1', custom_domain: 'p.example.com' })
    )
    render(<ProxySettings />)
    await screen.findByText('Reverse Proxy Configuration')
    expect(screen.getByText(/Configure your external proxy/)).toBeInTheDocument()
    expect(screen.getByLabelText(/External Proxy Address/)).toBeInTheDocument()
    expect(screen.getByLabelText('Custom Domain')).toBeInTheDocument()
    expect(screen.getByLabelText(/Use HTTPS/)).toBeInTheDocument()
  })

  it('reveals fields when switching to external and edits them', async () => {
    mockGet.mockResolvedValue(proxy())
    render(<ProxySettings />)
    await screen.findByText('Reverse Proxy Configuration')

    fireEvent.change(screen.getByLabelText('Reverse Proxy Mode'), { target: { value: 'external' } })
    const urlInput = screen.getByLabelText(/External Proxy Address/)
    fireEvent.change(urlInput, { target: { value: 'http://10.0.0.5' } })
    expect((urlInput as HTMLInputElement).value).toBe('http://10.0.0.5')

    fireEvent.change(screen.getByLabelText('Custom Domain'), { target: { value: 'p.example.com' } })
    fireEvent.click(screen.getByLabelText(/Use HTTPS/)) // toggle off
  })

  it('shows the built-in mode info', async () => {
    mockGet.mockResolvedValue(proxy({ proxy_mode: 'builtin' }))
    render(<ProxySettings />)
    await screen.findByText('Reverse Proxy Configuration')
    expect(screen.getByText(/Built-in nginx/)).toBeInTheDocument()
  })

  it('saves settings and shows a success message', async () => {
    mockGet.mockResolvedValue(proxy())
    mockUpdate.mockResolvedValue(proxy())
    render(<ProxySettings />)
    await screen.findByText('Reverse Proxy Configuration')

    fireEvent.click(screen.getByRole('button', { name: 'Save Proxy Settings' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(await screen.findByText(/Proxy settings saved successfully/)).toBeInTheDocument()
  })

  it('surfaces a save error (with fallback)', async () => {
    mockGet.mockResolvedValue(proxy())
    mockUpdate.mockRejectedValueOnce({ response: { data: { error: 'save boom' } } })
    render(<ProxySettings />)
    await screen.findByText('Reverse Proxy Configuration')

    fireEvent.click(screen.getByRole('button', { name: 'Save Proxy Settings' }))
    expect(await screen.findByText('save boom')).toBeInTheDocument()

    mockUpdate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Proxy Settings' }))
    expect(await screen.findByText('Failed to save proxy settings')).toBeInTheDocument()
  })

  it('surfaces a load error', async () => {
    mockGet.mockRejectedValue({ response: { data: { error: 'load boom' } } })
    render(<ProxySettings />)
    expect(await screen.findByText('load boom')).toBeInTheDocument()
  })
})
