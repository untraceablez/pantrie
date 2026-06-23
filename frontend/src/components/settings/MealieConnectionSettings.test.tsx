import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MealieConnectionSettings from './MealieConnectionSettings'
import * as mealie from '@/services/mealie'

vi.mock('@/services/mealie', () => ({
  getMealieConnection: vi.fn(),
  configureMealieConnection: vi.fn(),
  deleteMealieConnection: vi.fn(),
}))

const mockGet = vi.mocked(mealie.getMealieConnection)
const mockConfigure = vi.mocked(mealie.configureMealieConnection)
const mockDelete = vi.mocked(mealie.deleteMealieConnection)

const conn = (over = {}): mealie.MealieConnection => ({
  id: 1,
  household_id: 1,
  base_url: 'https://mealie.example.com',
  is_active: true,
  created_at: '',
  updated_at: '',
  ...over,
})

describe('MealieConnectionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows an admin-only notice to non-admins (no data fetch)', () => {
    render(<MealieConnectionSettings householdId={1} isAdmin={false} />)
    expect(screen.getByText('Mealie Connection')).toBeInTheDocument()
    expect(
      screen.getByText('Only household admins can configure the Mealie connection.')
    ).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('renders the connect form when no connection exists', async () => {
    mockGet.mockResolvedValue(null)
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('renders existing connection details with Update + Remove', async () => {
    mockGet.mockResolvedValue(conn())
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    expect(await screen.findByText(/Connected to/)).toBeInTheDocument()
    expect(screen.getByText('https://mealie.example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update connection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    expect(await screen.findByText('Failed to load Mealie connection')).toBeInTheDocument()
  })

  it('saves a new connection', async () => {
    mockGet.mockResolvedValue(null)
    mockConfigure.mockResolvedValue(conn())
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    await screen.findByRole('button', { name: 'Connect' })

    fireEvent.change(screen.getByPlaceholderText('https://mealie.example.com'), {
      target: { value: 'https://m.test' },
    })
    fireEvent.change(screen.getByPlaceholderText('Mealie API token'), { target: { value: 'tok' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() =>
      expect(mockConfigure).toHaveBeenCalledWith(1, { base_url: 'https://m.test', api_key: 'tok' })
    )
    expect(await screen.findByText('Mealie connection saved')).toBeInTheDocument()
  })

  it('surfaces a save error', async () => {
    mockGet.mockResolvedValue(null)
    mockConfigure.mockRejectedValue(new Error('bad'))
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    await screen.findByRole('button', { name: 'Connect' })

    fireEvent.change(screen.getByPlaceholderText('https://mealie.example.com'), {
      target: { value: 'https://m.test' },
    })
    fireEvent.change(screen.getByPlaceholderText('Mealie API token'), { target: { value: 'tok' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(
      await screen.findByText('Failed to save Mealie connection. Check the URL and API key.')
    ).toBeInTheDocument()
  })

  it('removes the connection after confirmation, and not when cancelled', async () => {
    mockGet.mockResolvedValue(conn())
    mockDelete.mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    await screen.findByRole('button', { name: 'Remove' })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(mockDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    // Connection cleared -> back to the Connect form
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it('surfaces a remove error', async () => {
    mockGet.mockResolvedValue(conn())
    mockDelete.mockRejectedValue(new Error('network'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MealieConnectionSettings householdId={1} isAdmin />)
    await screen.findByRole('button', { name: 'Remove' })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Failed to remove Mealie connection')).toBeInTheDocument()
  })
})
