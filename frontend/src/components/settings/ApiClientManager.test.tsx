import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ApiClientManager from './ApiClientManager'
import * as svc from '@/services/apiClients'

vi.mock('@/services/apiClients', () => ({
  listApiClients: vi.fn(),
  createApiClient: vi.fn(),
  revokeApiClient: vi.fn(),
}))

const mockList = vi.mocked(svc.listApiClients)
const mockCreate = vi.mocked(svc.createApiClient)
const mockRevoke = vi.mocked(svc.revokeApiClient)

const client = (over: Partial<svc.ApiClient> = {}): svc.ApiClient => ({
  id: 1,
  name: 'Mealie',
  client_id: 'cid-123',
  permissions: { read: true, write: false, delete: false },
  is_active: true,
  last_used_at: null,
  created_at: '',
  ...over,
})

describe('ApiClientManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows an admin-only notice to non-admins (no data fetch)', () => {
    render(<ApiClientManager householdId={1} isAdmin={false} />)
    expect(screen.getByText('API Clients')).toBeInTheDocument()
    expect(screen.getByText('Only household admins can manage API clients.')).toBeInTheDocument()
    expect(mockList).not.toHaveBeenCalled()
  })

  it('shows the empty state for admins', async () => {
    mockList.mockResolvedValue([])
    render(<ApiClientManager householdId={1} isAdmin />)
    expect(await screen.findByText('No API clients yet')).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    mockList.mockRejectedValue(new Error('network'))
    render(<ApiClientManager householdId={1} isAdmin />)
    expect(await screen.findByText('Failed to load API clients')).toBeInTheDocument()
  })

  it('lists active and revoked clients', async () => {
    mockList.mockResolvedValue([
      client({ last_used_at: '2026-01-01T00:00:00Z' }),
      client({ id: 2, name: 'Old', is_active: false }),
    ])
    render(<ApiClientManager householdId={1} isAdmin />)
    expect(await screen.findByText('Mealie')).toBeInTheDocument()
    expect(screen.getByText('Old')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('revoked')).toBeInTheDocument()
    // Only the active client gets a Revoke button
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1)
  })

  it('creates a client and shows the one-time secret, then dismisses it', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue({
      ...client(),
      client_secret: 'super-secret',
    } as svc.ApiClientCreated)
    render(<ApiClientManager householdId={1} isAdmin />)
    await screen.findByText('No API clients yet')

    fireEvent.change(screen.getByPlaceholderText('e.g. Mealie'), { target: { value: 'Mealie' } })
    fireEvent.click(screen.getByRole('checkbox')) // allow writes
    fireEvent.click(screen.getByRole('button', { name: 'Create client' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(1, {
        name: 'Mealie',
        permissions: { read: true, write: true },
      })
    )
    expect(await screen.findByText(/Copy this secret now/)).toBeInTheDocument()
    expect(screen.getByText('super-secret')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "I've saved it" }))
    expect(screen.queryByText(/Copy this secret now/)).not.toBeInTheDocument()
  })

  it('disables Create with no name', async () => {
    mockList.mockResolvedValue([])
    render(<ApiClientManager householdId={1} isAdmin />)
    await screen.findByText('No API clients yet')
    expect((screen.getByRole('button', { name: 'Create client' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('surfaces a create error', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('network'))
    render(<ApiClientManager householdId={1} isAdmin />)
    await screen.findByText('No API clients yet')

    fireEvent.change(screen.getByPlaceholderText('e.g. Mealie'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create client' }))
    expect(await screen.findByText('Failed to create API client')).toBeInTheDocument()
  })

  it('revokes a client after confirmation, and not when cancelled', async () => {
    mockList.mockResolvedValue([client()])
    mockRevoke.mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ApiClientManager householdId={1} isAdmin />)
    await screen.findByText('Mealie')

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(mockRevoke).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith(1, 1))
  })

  it('surfaces a revoke error', async () => {
    mockList.mockResolvedValue([client()])
    mockRevoke.mockRejectedValue(new Error('network'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ApiClientManager householdId={1} isAdmin />)
    await screen.findByText('Mealie')

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('Failed to revoke API client')).toBeInTheDocument()
  })
})
