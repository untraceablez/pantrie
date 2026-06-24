import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ItemDetailModal from './ItemDetailModal'
import * as allergenSvc from '@/services/allergen'
import { type InventoryItem } from '@/services/inventory'

vi.mock('@/services/allergen', () => ({
  listHouseholdAllergens: vi.fn(),
  checkIngredientsForAllergens: vi.fn(),
}))
vi.mock('./NutritionFactsLabel', () => ({
  default: () => <div data-testid="nutrition-facts-label" />,
}))

const mockList = vi.mocked(allergenSvc.listHouseholdAllergens)
const mockCheck = vi.mocked(allergenSvc.checkIngredientsForAllergens)

const item = (over: Partial<InventoryItem> = {}): InventoryItem =>
  ({
    id: 1,
    household_id: 7,
    name: 'Milk',
    category_id: null,
    location_id: null,
    description: null,
    quantity: 2,
    unit: null,
    purchase_date: null,
    expiration_date: null,
    barcode: null,
    brand: null,
    image_url: null,
    notes: null,
    ingredients: null,
    nutritional_info: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }) as InventoryItem

describe('ItemDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockList.mockResolvedValue([])
    mockCheck.mockReturnValue([])
  })

  it('renders the placeholder, name, and fetches household allergens', async () => {
    render(<ItemDetailModal item={item({ name: 'Milk' })} onClose={vi.fn()} />)
    expect(screen.getByText('Item Details')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Milk' })).toBeInTheDocument()
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(7))
  })

  it('renders the image, brand, and description when present', () => {
    render(
      <ItemDetailModal
        item={item({ image_url: 'http://x/i.png', brand: 'Acme', description: 'Whole' })}
        onClose={vi.fn()}
      />
    )
    expect((screen.getByAltText('Milk') as HTMLImageElement).src).toBe('http://x/i.png')
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Whole')).toBeInTheDocument()
  })

  it('logs an error when allergen fetch fails', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    render(<ItemDetailModal item={item()} onClose={vi.fn()} />)
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error fetching household allergens:', expect.any(Error))
    )
  })

  it('formats integer quantity and singularizes the unit', () => {
    render(<ItemDetailModal item={item({ quantity: 1, unit: 'cans' })} onClose={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('can')).toBeInTheDocument()
  })

  it('trims decimals and keeps the plural unit otherwise', () => {
    render(<ItemDetailModal item={item({ quantity: 2.5, unit: 'liters' })} onClose={vi.fn()} />)
    expect(screen.getByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('liters')).toBeInTheDocument()
  })

  it('renders 0 for a NaN quantity and leaves the unit untouched', () => {
    render(<ItemDetailModal item={item({ quantity: NaN as unknown as number, unit: 'kg' })} onClose={vi.fn()} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('falls back to String(quantity) if formatting throws', () => {
    const weird = { valueOf: () => 1.5 } as unknown as number
    render(<ItemDetailModal item={item({ quantity: weird })} onClose={vi.fn()} />)
    expect(screen.getByText('[object Object]')).toBeInTheDocument()
  })

  it.each([
    [-1, 'Expired'],
    [0, 'Expires today'],
    [2, 'Expires in 2d'],
    [6, 'Expires in 6d'],
    [30, 'Expires in 30d'],
  ])('shows the expiration status for %i days out', (days, label) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() + days)
    render(<ItemDetailModal item={item({ expiration_date: d.toISOString() })} onClose={vi.fn()} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText('Expires:')).toBeInTheDocument()
  })

  it('renders purchase date, barcode, and notes when set', () => {
    render(
      <ItemDetailModal
        item={item({ purchase_date: '2026-01-02T00:00:00Z', barcode: '0123', notes: 'keep cold' })}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Purchased:')).toBeInTheDocument()
    expect(screen.getByText('0123')).toBeInTheDocument()
    expect(screen.getByText('keep cold')).toBeInTheDocument()
  })

  it('warns about matched household and product allergens together', async () => {
    mockCheck.mockReturnValue(['peanuts'])
    render(
      <ItemDetailModal
        item={item({ ingredients: 'roasted oil', nutritional_info: JSON.stringify({ allergens: 'milk' }) })}
        onClose={vi.fn()}
      />
    )
    expect(await screen.findByText('Household Allergens Detected:')).toBeInTheDocument()
    expect(screen.getByText('peanuts')).toBeInTheDocument()
    expect(screen.getByText('Product Allergens:')).toBeInTheDocument()
    expect(screen.getByText('milk')).toBeInTheDocument()
  })

  it('ignores invalid nutritional_info JSON when computing allergens (no warning)', () => {
    render(<ItemDetailModal item={item({ nutritional_info: 'not json' })} onClose={vi.fn()} />)
    expect(screen.queryByText('Allergen Warning')).not.toBeInTheDocument()
  })

  it('renders the ingredients section', () => {
    render(<ItemDetailModal item={item({ ingredients: 'water, sugar' })} onClose={vi.fn()} />)
    expect(screen.getByText('water, sugar')).toBeInTheDocument()
  })

  it.each([['a'], ['b'], ['c'], ['d'], ['e']])(
    'renders the simple nutrition layout with grade %s and a serving size',
    (grade) => {
      render(
        <ItemDetailModal
          item={item({ nutritional_info: JSON.stringify({ nutrition_grade: grade, serving_size: '30g' }) })}
          onClose={vi.fn()}
        />
      )
      expect(screen.getByText('Nutritional Information')).toBeInTheDocument()
      expect(screen.getByText('Nutrition Grade:')).toBeInTheDocument()
      expect(screen.getByText(grade)).toBeInTheDocument()
      expect(screen.getByText('30g')).toBeInTheDocument()
      expect(screen.queryByTestId('nutrition-facts-label')).not.toBeInTheDocument()
    }
  )

  it.each([['a'], ['b'], ['c'], ['d'], ['e']])(
    'renders the FDA-style label when nutrition_facts is present (grade %s)',
    (grade) => {
      render(
        <ItemDetailModal
          item={item({
            nutritional_info: JSON.stringify({ nutrition_grade: grade, nutrition_facts: { calories: 100 } }),
          })}
          onClose={vi.fn()}
        />
      )
      expect(screen.getByTestId('nutrition-facts-label')).toBeInTheDocument()
      expect(screen.getByText(grade)).toBeInTheDocument()
    }
  )

  it('renders nothing for the nutrition block when the JSON cannot be parsed', () => {
    // Invalid JSON makes the render-time parse throw, so the nutrition IIFE returns null.
    render(<ItemDetailModal item={item({ nutritional_info: '{bad' })} onClose={vi.fn()} />)
    expect(screen.queryByText('Nutritional Information')).not.toBeInTheDocument()
    expect(screen.queryByTestId('nutrition-facts-label')).not.toBeInTheDocument()
  })

  it('wires the footer Delete, Edit, and Close actions', () => {
    const onClose = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const it1 = item()
    render(<ItemDetailModal item={it1} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(it1)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(it1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('omits Delete/Edit when their handlers are absent and closes via the header X', () => {
    const onClose = vi.fn()
    render(<ItemDetailModal item={item()} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    // Header close button is the first button in the modal.
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalled()
  })
})
