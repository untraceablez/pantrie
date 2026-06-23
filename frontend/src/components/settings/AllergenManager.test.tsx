import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AllergenManager from './AllergenManager'
import * as allergenService from '@/services/allergen'

vi.mock('@/services/allergen', () => ({
  listHouseholdAllergens: vi.fn(),
  createAllergen: vi.fn(),
  deleteAllergen: vi.fn(),
}))

const mockList = vi.mocked(allergenService.listHouseholdAllergens)
const mockCreate = vi.mocked(allergenService.createAllergen)
const mockDelete = vi.mocked(allergenService.deleteAllergen)

const allergen = (over: Partial<allergenService.Allergen> = {}): allergenService.Allergen => ({
  id: 1,
  household_id: 1,
  name: 'peanuts',
  created_at: '',
  updated_at: '',
  ...over,
})

describe('AllergenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows loading then the allergen list', async () => {
    mockList.mockResolvedValue([allergen(), allergen({ id: 2, name: 'dairy' })])
    render(<AllergenManager householdId={1} canEdit />)
    expect(screen.getByText('Loading allergens...')).toBeInTheDocument()

    expect(await screen.findByText('peanuts')).toBeInTheDocument()
    expect(screen.getByText('dairy')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue([])
    render(<AllergenManager householdId={1} canEdit />)
    expect(await screen.findByText('No custom allergens yet')).toBeInTheDocument()
  })

  it('shows an error when the fetch fails', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    render(<AllergenManager householdId={1} canEdit />)
    expect(await screen.findByText('Failed to load allergens')).toBeInTheDocument()
  })

  it('adds an allergen, clears the input, and refetches', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(allergen())
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('No custom allergens yet')

    const input = screen.getByPlaceholderText(/enter allergen name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '  soy  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(1, { name: 'soy' }))
    await waitFor(() => expect(input.value).toBe(''))
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('disables Add for empty input and ignores an empty submit', async () => {
    mockList.mockResolvedValue([])
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('No custom allergens yet')

    const addButton = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement
    expect(addButton.disabled).toBe(true)

    // Submitting the form with an empty field is a no-op (early return).
    const input = screen.getByPlaceholderText(/enter allergen name/i)
    fireEvent.submit(input.closest('form')!)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('surfaces an add error', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue({ response: { data: { error: 'duplicate' } } })
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('No custom allergens yet')

    fireEvent.change(screen.getByPlaceholderText(/enter allergen name/i), {
      target: { value: 'soy' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('duplicate')).toBeInTheDocument()
  })

  it('falls back to a generic add error message for a plain error', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('network'))
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('No custom allergens yet')

    fireEvent.change(screen.getByPlaceholderText(/enter allergen name/i), {
      target: { value: 'soy' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Failed to add allergen')).toBeInTheDocument()
  })

  it('deletes an allergen after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([allergen()])
    mockDelete.mockResolvedValue()
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('peanuts')

    fireEvent.click(screen.getByTitle('Delete allergen'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockList.mockResolvedValue([allergen()])
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('peanuts')

    fireEvent.click(screen.getByTitle('Delete allergen'))
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('surfaces a delete error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([allergen()])
    mockDelete.mockRejectedValue({ response: { data: { error: 'nope' } } })
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('peanuts')

    fireEvent.click(screen.getByTitle('Delete allergen'))
    expect(await screen.findByText('nope')).toBeInTheDocument()
  })

  it('falls back to a generic delete error message for a plain error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([allergen()])
    mockDelete.mockRejectedValue(new Error('network'))
    render(<AllergenManager householdId={1} canEdit />)
    await screen.findByText('peanuts')

    fireEvent.click(screen.getByTitle('Delete allergen'))
    expect(await screen.findByText('Failed to delete allergen')).toBeInTheDocument()
  })

  it('hides the add form and delete buttons when canEdit is false', async () => {
    mockList.mockResolvedValue([allergen()])
    render(<AllergenManager householdId={1} canEdit={false} />)
    await screen.findByText('peanuts')
    expect(screen.queryByPlaceholderText(/enter allergen name/i)).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete allergen')).not.toBeInTheDocument()
  })
})
