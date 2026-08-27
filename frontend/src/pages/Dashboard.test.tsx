import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dashboard from './Dashboard'
import * as api from '@/services/api'
import * as householdSvc from '@/services/household'
import * as authSvc from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/api', () => ({ getDashboardSummary: vi.fn() }))
vi.mock('@/services/household', () => ({ listHouseholds: vi.fn() }))
vi.mock('@/services/auth', () => ({ logout: vi.fn() }))

const mockGetSummary = vi.mocked(api.getDashboardSummary)
const mockListHouseholds = vi.mocked(householdSvc.listHouseholds)
const mockLogout = vi.mocked(authSvc.logout)

const household = (
  over: Partial<householdSvc.HouseholdWithRole> = {}
): householdSvc.HouseholdWithRole =>
  ({ id: 1, name: 'Home', user_role: 'admin', ...over }) as householdSvc.HouseholdWithRole

const summary = (over: Partial<api.DashboardSummary> = {}): api.DashboardSummary => ({
  household_id: 1,
  generated_on: '2026-06-15',
  expiring_within_days: 7,
  low_stock_threshold: '1.00',
  counts: {
    total_items: 12,
    expired: 2,
    expiring_soon: 3,
    low_stock: 4,
    no_expiration_date: 5,
  },
  by_location: [
    { location_id: 5, name: 'Pantry', icon: '🥫', item_count: 7 },
    { location_id: null, name: 'Unassigned', icon: null, item_count: 5 },
  ],
  by_category: [{ category_id: 9, name: 'Dairy', icon: '🥛', item_count: 3 }],
  recently_added: [
    {
      id: 1,
      name: 'Milk',
      brand: 'Farm Co',
      quantity: '2.00',
      unit: 'L',
      expiration_date: '2026-06-20',
      created_at: '2026-06-14T10:00:00Z',
    },
    {
      id: 2,
      name: 'Salt',
      brand: null,
      quantity: '1.00',
      unit: null,
      expiration_date: null,
      created_at: '2026-06-13T10:00:00Z',
    },
  ],
  ...over,
})

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({ user: { id: 1, email: 'a@b.c' } as never, refreshToken: 'ref-1' })
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockListHouseholds.mockResolvedValue([household()])
    mockGetSummary.mockResolvedValue(summary())
    mockLogout.mockResolvedValue()
  })

  it('shows a loading state before the summary arrives', () => {
    render(<Dashboard />)
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
  })

  it('requests the summary for the first household', async () => {
    render(<Dashboard />)
    await waitFor(() =>
      expect(mockGetSummary).toHaveBeenCalledWith(1, {
        expiring_within_days: 7,
        low_stock_threshold: 1,
      })
    )
  })

  it('renders the four summary cards with their counts', async () => {
    render(<Dashboard />)
    await screen.findByText('Expired')

    const card = (label: string) =>
      screen.getByRole('button', { name: new RegExp(label) }) as HTMLElement

    expect(within(card('Expired')).getByText('2')).toBeInTheDocument()
    expect(within(card('Expiring soon')).getByText('3')).toBeInTheDocument()
    expect(within(card('Expiring soon')).getByText('Within 7 days')).toBeInTheDocument()
    expect(within(card('Low stock')).getByText('4')).toBeInTheDocument()
    expect(within(card('Low stock')).getByText('Quantity of 1 or less')).toBeInTheDocument()
    expect(within(card('Total items')).getByText('12')).toBeInTheDocument()
    expect(
      within(card('Total items')).getByText('5 without an expiry date')
    ).toBeInTheDocument()
  })

  it.each([
    ['Expired', '/inventory?expired=true&sort_by=expiration_date&sort_order=asc'],
    [
      'Expiring soon',
      '/inventory?expiring_within_days=7&sort_by=expiration_date&sort_order=asc',
    ],
    ['Low stock', '/inventory?low_stock_threshold=1&sort_by=quantity&sort_order=asc'],
    ['Total items', '/inventory'],
  ])('deep-links the %s card into the filtered inventory', async (label, target) => {
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(label) }))
    expect(mockNavigate).toHaveBeenCalledWith(target)
  })

  it('renders the location breakdown and links a location into the inventory', async () => {
    render(<Dashboard />)
    const section = (await screen.findByText('By location')).closest('section') as HTMLElement
    expect(within(section).getByText('Pantry')).toBeInTheDocument()
    expect(within(section).getByText('7')).toBeInTheDocument()
    expect(within(section).getByText('Unassigned')).toBeInTheDocument()

    fireEvent.click(within(section).getByRole('button', { name: /Pantry/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?location_id=5')

    fireEvent.click(within(section).getByRole('button', { name: /Unassigned/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/inventory')
  })

  it('renders the category breakdown', async () => {
    render(<Dashboard />)
    const section = (await screen.findByText('By category')).closest('section') as HTMLElement
    expect(within(section).getByText('Dairy')).toBeInTheDocument()
    expect(within(section).getByText('3')).toBeInTheDocument()
  })

  it('renders the recently added list with quantities and expiry dates', async () => {
    render(<Dashboard />)
    const section = (await screen.findByText('Recently added')).closest('section') as HTMLElement
    expect(within(section).getByText('Milk')).toBeInTheDocument()
    expect(within(section).getByText('Farm Co')).toBeInTheDocument()
    expect(within(section).getByText('2 L')).toBeInTheDocument()
    expect(within(section).getByText('Salt')).toBeInTheDocument()
    expect(within(section).getByText('1')).toBeInTheDocument()
    expect(within(section).getByText('No expiry')).toBeInTheDocument()
  })

  it('falls back to the raw value for an unparseable expiry date', async () => {
    mockGetSummary.mockResolvedValue(
      summary({
        recently_added: [
          {
            id: 3,
            name: 'Mystery',
            brand: null,
            quantity: '1.00',
            unit: null,
            expiration_date: 'not-a-date',
            created_at: '2026-06-13T10:00:00Z',
          },
        ],
      })
    )
    render(<Dashboard />)
    expect(await screen.findByText('not-a-date')).toBeInTheDocument()
  })

  it('shows empty states when the household has no items', async () => {
    mockGetSummary.mockResolvedValue(
      summary({
        counts: {
          total_items: 0,
          expired: 0,
          expiring_soon: 0,
          low_stock: 0,
          no_expiration_date: 0,
        },
        by_location: [],
        by_category: [],
        recently_added: [],
      })
    )
    render(<Dashboard />)

    expect(await screen.findByText('Nothing added yet.')).toBeInTheDocument()
    expect(screen.getAllByText('No items in your inventory yet')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Add your first item' }))
    expect(mockNavigate).toHaveBeenCalledWith('/add-item')
  })

  it('shows "No household selected" when the user has no households', async () => {
    mockListHouseholds.mockResolvedValue([])
    render(<Dashboard />)
    expect(await screen.findByText('No household selected')).toBeInTheDocument()
    expect(mockGetSummary).not.toHaveBeenCalled()
  })

  it('does not fetch anything without a signed-in user', async () => {
    useAuthStore.setState({ user: null })
    render(<Dashboard />)
    expect(await screen.findByText('Loading dashboard...')).toBeInTheDocument()
    expect(mockListHouseholds).not.toHaveBeenCalled()
  })

  it('surfaces a household load failure', async () => {
    mockListHouseholds.mockRejectedValue(new Error('down'))
    render(<Dashboard />)
    expect(await screen.findByText('Failed to load households')).toBeInTheDocument()
  })

  it('surfaces the API error message when the summary fails', async () => {
    mockGetSummary.mockRejectedValue({ response: { data: { error: 'Nope' } } })
    render(<Dashboard />)
    expect(await screen.findByText('Nope')).toBeInTheDocument()
  })

  it('falls back to a generic message when the summary fails without a body', async () => {
    mockGetSummary.mockRejectedValue(new Error('boom'))
    render(<Dashboard />)
    expect(await screen.findByText('Failed to load dashboard')).toBeInTheDocument()
    expect(await screen.findByText('No dashboard data available')).toBeInTheDocument()
  })

  it('switches households from the selector', async () => {
    mockListHouseholds.mockResolvedValue([household(), household({ id: 2, name: 'Cabin' })])
    render(<Dashboard />)
    const select = await screen.findByLabelText('Select Household')
    fireEvent.change(select, { target: { value: '2' } })
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledWith(2, expect.anything()))
  })

  it.each([
    ['Inventory', '/inventory'],
    ['Recipes', '/recipes'],
    ['Settings', '/settings'],
    ['Add Item', '/add-item'],
  ])('navigates to %s from the header', async (label, target) => {
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: label }))
    expect(mockNavigate).toHaveBeenCalledWith(target)
  })

  it('logs out and returns to login', async () => {
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(mockLogout).toHaveBeenCalledWith('ref-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('clears auth even when logout fails or there is no refresh token', async () => {
    useAuthStore.setState({ user: { id: 1 } as never, refreshToken: null })
    const first = render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(mockLogout).not.toHaveBeenCalled()
    first.unmount()

    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 1 } as never, refreshToken: 'ref-2' })
    mockListHouseholds.mockResolvedValue([household()])
    mockGetSummary.mockResolvedValue(summary())
    mockLogout.mockRejectedValue(new Error('logout fail'))
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error logging out:', expect.any(Error))
    )
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('uses the light logo in dark mode', async () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    render(<Dashboard />)
    expect((await screen.findByAltText('Pantrie')) as HTMLImageElement).toHaveAttribute(
      'src',
      '/pantrie-logo-light.png'
    )
  })
})
