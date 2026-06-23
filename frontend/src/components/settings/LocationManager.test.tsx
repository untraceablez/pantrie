import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LocationManager from './LocationManager'
import * as locationService from '@/services/location'

vi.mock('@/services/location', () => ({
  listHouseholdLocations: vi.fn(),
  deleteLocation: vi.fn(),
}))

// Stub the modal children so this suite stays focused on the manager itself.
vi.mock('./AddLocationModal', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => (
    <div data-testid="add-modal">
      <button onClick={onSuccess}>add-success</button>
      <button onClick={onClose}>add-close</button>
    </div>
  ),
}))
vi.mock('./EditLocationModal', () => ({
  default: ({
    location,
    onClose,
    onSuccess,
  }: {
    location: { name: string }
    onClose: () => void
    onSuccess: () => void
  }) => (
    <div data-testid="edit-modal">
      <span>editing {location.name}</span>
      <button onClick={onSuccess}>edit-success</button>
      <button onClick={onClose}>edit-close</button>
    </div>
  ),
}))

const mockList = vi.mocked(locationService.listHouseholdLocations)
const mockDelete = vi.mocked(locationService.deleteLocation)

const loc = (over: Partial<locationService.Location> = {}): locationService.Location => ({
  id: 1,
  household_id: 1,
  name: 'Pantry',
  description: 'Dry goods',
  icon: '🗄️',
  created_at: '',
  updated_at: '',
  ...over,
})

describe('LocationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows loading then renders locations (with and without icon/description)', async () => {
    mockList.mockResolvedValue([
      loc(),
      loc({ id: 2, name: 'Garage', description: null, icon: null }),
    ])
    render(<LocationManager householdId={1} canEdit />)
    expect(screen.getByText('Loading locations...')).toBeInTheDocument()

    expect(await screen.findByText('Pantry')).toBeInTheDocument()
    expect(screen.getByText('Dry goods')).toBeInTheDocument()
    expect(screen.getByText('Garage')).toBeInTheDocument()
  })

  it('renders the empty state and opens the add modal from it', async () => {
    mockList.mockResolvedValue([])
    render(<LocationManager householdId={1} canEdit />)
    expect(await screen.findByText('No locations yet')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add your first location'))
    expect(screen.getByTestId('add-modal')).toBeInTheDocument()
  })

  it('shows an error when the fetch fails', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    render(<LocationManager householdId={1} canEdit />)
    expect(await screen.findByText('Failed to load locations')).toBeInTheDocument()
  })

  it('hides edit controls when canEdit is false', async () => {
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit={false} />)
    await screen.findByText('Pantry')
    expect(screen.queryByTitle('Add new location')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Edit location')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete location')).not.toBeInTheDocument()
  })

  it('opens the add modal and refetches on success', async () => {
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Add new location'))
    expect(screen.getByTestId('add-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByText('add-success'))
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('add-modal')).not.toBeInTheDocument()
  })

  it('opens the edit modal and refetches on success', async () => {
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Edit location'))
    expect(screen.getByText('editing Pantry')).toBeInTheDocument()

    fireEvent.click(screen.getByText('edit-success'))
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })

  it('opens the edit modal, then closes it via onClose', async () => {
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Edit location'))
    fireEvent.click(screen.getByText('edit-close'))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })

  it('closes the add modal via onClose', async () => {
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Add new location'))
    fireEvent.click(screen.getByText('add-close'))
    expect(screen.queryByTestId('add-modal')).not.toBeInTheDocument()
  })

  it('deletes a location after confirmation and refetches', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([loc()])
    mockDelete.mockResolvedValue()
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Delete location'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('does not delete when the confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockList.mockResolvedValue([loc()])
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Delete location'))
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('surfaces a delete error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([loc()])
    mockDelete.mockRejectedValue({ response: { data: { error: 'in use' } } })
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Delete location'))
    expect(await screen.findByText('in use')).toBeInTheDocument()
  })

  it('falls back to a generic delete error message for a plain error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([loc()])
    mockDelete.mockRejectedValue(new Error('network'))
    render(<LocationManager householdId={1} canEdit />)
    await screen.findByText('Pantry')

    fireEvent.click(screen.getByTitle('Delete location'))
    expect(await screen.findByText('Failed to delete location')).toBeInTheDocument()
  })
})
