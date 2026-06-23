import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditLocationModal from './EditLocationModal'
import * as locationService from '@/services/location'

vi.mock('@/services/location', () => ({ updateLocation: vi.fn() }))

const mockUpdate = vi.mocked(locationService.updateLocation)

const loc = (over: Partial<locationService.Location> = {}): locationService.Location => ({
  id: 5,
  household_id: 1,
  name: 'Pantry',
  description: 'Dry goods',
  icon: '🗄️',
  created_at: '',
  updated_at: '',
  ...over,
})

const setup = (location = loc()) => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<EditLocationModal location={location} onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

describe('EditLocationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('pre-fills the form from the location', () => {
    setup()
    expect((screen.getByLabelText(/location name/i) as HTMLInputElement).value).toBe('Pantry')
    expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe('Dry goods')
  })

  it('saves changes and calls onSuccess + onClose', async () => {
    mockUpdate.mockResolvedValue({} as locationService.Location)
    const { onClose, onSuccess } = setup()

    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Cupboard' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(5, {
        name: 'Cupboard',
        description: 'Dry goods',
        icon: '🗄️',
      })
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('initializes a custom (non-preset) icon into the custom field', async () => {
    mockUpdate.mockResolvedValue({} as locationService.Location)
    setup(loc({ icon: '🦄' }))

    expect((screen.getByPlaceholderText('Any emoji') as HTMLInputElement).value).toBe('🦄')

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(5, expect.objectContaining({ icon: '🦄' }))
    )
  })

  it('lets the user pick a preset emoji or type a custom one', async () => {
    mockUpdate.mockResolvedValue({} as locationService.Location)
    setup() // starts with preset icon 🗄️

    // Switch to a different preset emoji...
    fireEvent.click(screen.getByRole('button', { name: '❄️' }))
    // ...then override with a custom emoji (clears the preset selection).
    fireEvent.change(screen.getByPlaceholderText('Any emoji'), { target: { value: '🦄' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(5, expect.objectContaining({ icon: '🦄' }))
    )
  })

  it('validates that a name is required', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('handles a location with null description/icon', async () => {
    mockUpdate.mockResolvedValue({} as locationService.Location)
    setup(loc({ description: null, icon: null }))

    expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByPlaceholderText('Any emoji') as HTMLInputElement).value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(5, expect.objectContaining({ icon: null }))
    )
  })

  it('surfaces an update error (structured + fallback message)', async () => {
    mockUpdate.mockRejectedValue({ response: { data: { error: 'nope' } } })
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('nope')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    // A plain error (no response payload) falls back to the generic message.
    mockUpdate.mockRejectedValue(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText('Failed to update location. Please try again.')
    ).toBeInTheDocument()
  })

  it('closes via the Cancel button', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
