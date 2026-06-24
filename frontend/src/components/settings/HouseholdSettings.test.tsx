import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HouseholdSettings from './HouseholdSettings'
import { useAuthStore } from '@/store/authStore'
import * as householdSvc from '@/services/household'

vi.mock('@/services/household', () => ({
  listHouseholds: vi.fn(),
  updateHousehold: vi.fn(),
}))

// Stub the heavy child managers; they have their own suites.
vi.mock('./LocationManager', () => ({ default: () => <div>LOCATION MANAGER</div> }))
vi.mock('./AllergenManager', () => ({ default: () => <div>ALLERGEN MANAGER</div> }))
vi.mock('./StapleManager', () => ({ default: () => <div>STAPLE MANAGER</div> }))
vi.mock('./HouseholdMembers', () => ({ default: () => <div>HOUSEHOLD MEMBERS</div> }))
vi.mock('./ApiClientManager', () => ({ default: () => <div>API CLIENTS</div> }))
vi.mock('./MealieConnectionSettings', () => ({ default: () => <div>MEALIE SETTINGS</div> }))

const mockList = vi.mocked(householdSvc.listHouseholds)
const mockUpdate = vi.mocked(householdSvc.updateHousehold)

const hh = (over: Partial<householdSvc.HouseholdWithRole> = {}): householdSvc.HouseholdWithRole => ({
  id: 1,
  name: 'Home',
  description: 'Our place',
  created_at: '',
  updated_at: '',
  user_role: 'admin',
  ...over,
})

describe('HouseholdSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useAuthStore.setState({ user: { id: 1 } as never, isAuthenticated: true })
  })

  it('renders the loaded household with editable details (admin)', async () => {
    mockList.mockResolvedValue([hh()])
    render(<HouseholdSettings />)

    expect(await screen.findByText('Household Details')).toBeInTheDocument()
    // Name is populated by a follow-up effect, so await the value.
    expect(await screen.findByDisplayValue('Home')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    // Child managers mount
    expect(screen.getByText('HOUSEHOLD MEMBERS')).toBeInTheDocument()
    expect(screen.getByText('LOCATION MANAGER')).toBeInTheDocument()
    expect(screen.getByText('MEALIE SETTINGS')).toBeInTheDocument()
  })

  it('shows the empty state when there are no households', async () => {
    mockList.mockResolvedValue([])
    render(<HouseholdSettings />)
    expect(
      await screen.findByText('No households found. Create one from the Add Item page.')
    ).toBeInTheDocument()
  })

  it('falls back to the empty state when loading fails', async () => {
    mockList.mockRejectedValue(new Error('network'))
    render(<HouseholdSettings />)
    expect(
      await screen.findByText('No households found. Create one from the Add Item page.')
    ).toBeInTheDocument()
  })

  it('warns and disables editing for viewers', async () => {
    mockList.mockResolvedValue([hh({ user_role: 'viewer' })])
    render(<HouseholdSettings />)
    await screen.findByText('Household Details')

    expect(
      screen.getByText('You need editor or admin role to modify household settings.')
    ).toBeInTheDocument()
    expect((screen.getByLabelText(/household name/i) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
  })

  it('switches the active household via the selector', async () => {
    mockList.mockResolvedValue([
      hh({ id: 1, name: 'Home' }),
      hh({ id: 2, name: 'Work', user_role: 'editor' }),
    ])
    render(<HouseholdSettings />)
    await screen.findByDisplayValue('Home')

    fireEvent.change(screen.getByLabelText('Select Household'), { target: { value: '2' } })
    expect(await screen.findByDisplayValue('Work')).toBeInTheDocument()
  })

  it('saves household changes and shows success', async () => {
    mockList.mockResolvedValue([hh()])
    mockUpdate.mockResolvedValue(hh() as never)
    render(<HouseholdSettings />)
    await screen.findByDisplayValue('Home') // wait for name + description to populate

    fireEvent.change(screen.getByLabelText(/household name/i), { target: { value: 'New Home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'New Home', description: 'Our place' })
    )
    expect(await screen.findByText('Household settings saved successfully!')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(2) // refetch after save
  })

  it('surfaces a save error (detail + fallback)', async () => {
    mockList.mockResolvedValue([hh()])
    mockUpdate.mockRejectedValueOnce({ response: { data: { error: 'name taken' } } })
    render(<HouseholdSettings />)
    await screen.findByText('Household Details')

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('name taken')).toBeInTheDocument()

    mockUpdate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Failed to update household')).toBeInTheDocument()
  })
})
