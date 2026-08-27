import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as allergenSvc from '@/services/allergen'
import {
  loadHouseholdAllergenMatches,
  resetAllergenWarningCache,
  useItemAllergenWarnings,
  useTextAllergenWarnings,
} from './useAllergenWarnings'

vi.mock('@/services/allergen', () => ({
  getInventoryAllergenMatches: vi.fn(),
  checkTextsForAllergens: vi.fn(),
}))

const mockMatches = vi.mocked(allergenSvc.getInventoryAllergenMatches)
const mockCheck = vi.mocked(allergenSvc.checkTextsForAllergens)

/** Renders whatever the item hook returns, so it can be asserted on. */
function ItemProbe({ householdId, itemId }: { householdId: number; itemId: number }) {
  const warnings = useItemAllergenWarnings(householdId, itemId)
  return <span data-testid={`item-${itemId}`}>{warnings.join(', ') || 'none'}</span>
}

function TextProbe({ householdId, text }: { householdId: number | null; text: string }) {
  const warnings = useTextAllergenWarnings(householdId, text)
  return <span data-testid="text">{warnings.join(', ') || 'none'}</span>
}

describe('useAllergenWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllergenWarningCache()
    mockMatches.mockResolvedValue([])
    mockCheck.mockResolvedValue([])
  })

  it('surfaces the allergens matched for the rendered item', async () => {
    mockMatches.mockResolvedValue([
      { item_id: 3, name: 'Cookies', allergens: ['milk', 'soy'] },
    ])
    render(<ItemProbe householdId={7} itemId={3} />)
    expect(await screen.findByText('milk, soy')).toBeInTheDocument()
  })

  it('shows nothing for an item the backend did not flag', async () => {
    mockMatches.mockResolvedValue([
      { item_id: 3, name: 'Cookies', allergens: ['milk'] },
    ])
    render(<ItemProbe householdId={7} itemId={99} />)
    await waitFor(() => expect(mockMatches).toHaveBeenCalled())
    expect(screen.getByTestId('item-99')).toHaveTextContent('none')
  })

  it('fetches once for a whole list of items instead of once per item', async () => {
    mockMatches.mockResolvedValue([
      { item_id: 2, name: 'Cookies', allergens: ['milk'] },
    ])
    render(
      <>
        <ItemProbe householdId={7} itemId={1} />
        <ItemProbe householdId={7} itemId={2} />
        <ItemProbe householdId={7} itemId={3} />
      </>
    )
    expect(await screen.findByText('milk')).toBeInTheDocument()
    // The N+1 this replaces would be three calls.
    expect(mockMatches).toHaveBeenCalledTimes(1)
    expect(mockMatches).toHaveBeenCalledWith(7)
  })

  it('fetches separately per household', async () => {
    render(
      <>
        <ItemProbe householdId={7} itemId={1} />
        <ItemProbe householdId={8} itemId={1} />
      </>
    )
    await waitFor(() => expect(mockMatches).toHaveBeenCalledTimes(2))
    expect(mockMatches).toHaveBeenCalledWith(7)
    expect(mockMatches).toHaveBeenCalledWith(8)
  })

  it('renders without warnings when the lookup fails, and retries next time', async () => {
    mockMatches.mockRejectedValueOnce(new Error('boom'))
    render(<ItemProbe householdId={7} itemId={1} />)
    await waitFor(() => expect(mockMatches).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('item-1')).toHaveTextContent('none')

    // The failure is not cached.
    mockMatches.mockResolvedValue([{ item_id: 1, name: 'X', allergens: ['soy'] }])
    await expect(loadHouseholdAllergenMatches(7)).resolves.toEqual(
      new Map([[1, ['soy']]])
    )
  })

  it('checks unsaved text and reports the matched allergens', async () => {
    mockCheck.mockResolvedValue([{ text: 'whole milk', allergens: ['milk'] }])
    render(<TextProbe householdId={7} text="whole milk" />)
    expect(await screen.findByText('milk')).toBeInTheDocument()
    expect(mockCheck).toHaveBeenCalledWith(7, ['whole milk'])
  })

  it('does not call the API for blank text or a missing household', async () => {
    const { rerender } = render(<TextProbe householdId={7} text="   " />)
    rerender(<TextProbe householdId={null} text="whole milk" />)
    await waitFor(() => expect(screen.getByTestId('text')).toHaveTextContent('none'))
    expect(mockCheck).not.toHaveBeenCalled()
  })

  it('leaves the text warning empty when the check fails', async () => {
    mockCheck.mockRejectedValue(new Error('boom'))
    render(<TextProbe householdId={7} text="whole milk" />)
    await waitFor(() => expect(mockCheck).toHaveBeenCalled())
    expect(screen.getByTestId('text')).toHaveTextContent('none')
  })

  it('leaves the text warning empty when the API returns no result row', async () => {
    mockCheck.mockResolvedValue([])
    render(<TextProbe householdId={7} text="whole milk" />)
    await waitFor(() => expect(mockCheck).toHaveBeenCalled())
    expect(screen.getByTestId('text')).toHaveTextContent('none')
  })
})
