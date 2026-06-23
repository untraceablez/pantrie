import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddLocationModal from './AddLocationModal'
import * as locationService from '@/services/location'

vi.mock('@/services/location', () => ({ createLocation: vi.fn() }))

const mockCreate = vi.mocked(locationService.createLocation)

const setup = () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<AddLocationModal householdId={9} onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

describe('AddLocationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('validates that a name is required', async () => {
    setup()
    // Whitespace satisfies the `required` attribute but fails the trim() check.
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('auto-suggests an emoji from the name and creates the location', async () => {
    mockCreate.mockResolvedValue({} as locationService.Location)
    const { onClose, onSuccess } = setup()

    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Freezer' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'cold stuff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        household_id: 9,
        name: 'Freezer',
        description: 'cold stuff',
        icon: '🧊', // suggested from "freezer"
      })
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('lets a custom icon override the suggestion/preset', async () => {
    mockCreate.mockResolvedValue({} as locationService.Location)
    setup()

    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Nook' } })
    fireEvent.change(screen.getByPlaceholderText('Any emoji'), { target: { value: '🦄' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ icon: '🦄' }))
    )
  })

  it('selects a preset icon when clicked', async () => {
    mockCreate.mockResolvedValue({} as locationService.Location)
    setup()

    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Box' } })
    fireEvent.click(screen.getByRole('button', { name: '❄️' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ icon: '❄️' }))
    )
  })

  it('surfaces a create error (structured + fallback message)', async () => {
    mockCreate.mockRejectedValue({ response: { data: { error: 'dup name' } } })
    setup()
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Pantry' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))
    expect(await screen.findByText('dup name')).toBeInTheDocument()

    // Plain error -> generic fallback message.
    mockCreate.mockRejectedValue(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Location' }))
    expect(
      await screen.findByText('Failed to create location. Please try again.')
    ).toBeInTheDocument()
  })

  it('closes via the Cancel button', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
