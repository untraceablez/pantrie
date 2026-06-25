import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import InventoryItemCard from './InventoryItemCard'
import * as allergenSvc from '@/services/allergen'
import { type InventoryItem } from '@/services/inventory'

vi.mock('@/services/allergen', () => ({
  listHouseholdAllergens: vi.fn(),
  checkIngredientsForAllergens: vi.fn(),
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

describe('InventoryItemCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockList.mockResolvedValue([])
    mockCheck.mockReturnValue([])
  })

  it('renders a placeholder when there is no image, and the item name', async () => {
    render(<InventoryItemCard item={item({ name: 'Milk' })} />)
    expect(screen.getByText('Milk')).toBeInTheDocument()
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(7))
  })

  it('renders an image when image_url is set', async () => {
    render(<InventoryItemCard item={item({ image_url: 'http://x/i.png', name: 'Milk' })} />)
    const img = screen.getByAltText('Milk') as HTMLImageElement
    expect(img.src).toBe('http://x/i.png')
  })

  it('logs an error when allergen fetch fails', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    render(<InventoryItemCard item={item()} />)
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching household allergens:', expect.any(Error)))
  })

  it('shows edit and delete buttons and fires their callbacks', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const it1 = item()
    render(<InventoryItemCard item={it1} onEdit={onEdit} onDelete={onDelete} />)
    fireEvent.click(screen.getByTitle('Edit item'))
    expect(onEdit).toHaveBeenCalledWith(it1)
    fireEvent.click(screen.getByTitle('Delete item'))
    expect(onDelete).toHaveBeenCalledWith(it1)
  })

  it('omits edit/delete buttons when no handlers are given', () => {
    render(<InventoryItemCard item={item()} />)
    expect(screen.queryByTitle('Edit item')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument()
  })

  it('renders brand, description, and notes when present', () => {
    render(
      <InventoryItemCard item={item({ brand: 'Acme', description: 'Whole', notes: 'cold' })} />
    )
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Whole')).toBeInTheDocument()
    expect(screen.getByText('cold')).toBeInTheDocument()
  })

  it('formats integer quantity without decimals and singularizes the unit', () => {
    render(<InventoryItemCard item={item({ quantity: 1, unit: 'cans' })} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('can')).toBeInTheDocument() // singularized at qty 1
  })

  it('keeps plural unit and trims decimal quantity for non-one quantities', () => {
    render(<InventoryItemCard item={item({ quantity: 2.5, unit: 'liters' })} />)
    expect(screen.getByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('liters')).toBeInTheDocument()
  })

  it('renders 0 for a NaN quantity and leaves the unit untouched', () => {
    render(<InventoryItemCard item={item({ quantity: NaN as unknown as number, unit: 'kg' })} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('falls back to String(quantity) if formatting throws', () => {
    // A non-integer that lacks toFixed makes the formatter throw, hitting the catch.
    const weird = { valueOf: () => 1.5 } as unknown as number
    render(<InventoryItemCard item={item({ quantity: weird })} />)
    expect(screen.getByText('[object Object]')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Error formatting quantity:', expect.any(Error))
  })

  it.each([
    [-1, 'Expired'],
    [0, 'Expires today'],
    [2, 'Expires in 2d'],
    [6, 'Expires in 6d'],
    [30, 'Expires in 30d'],
  ])('shows expiration status for %i days out', (days, label) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() + days)
    render(<InventoryItemCard item={item({ expiration_date: d.toISOString() })} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(/Expires:/)).toBeInTheDocument()
  })

  it('renders purchase date and barcode rows when set', () => {
    render(<InventoryItemCard item={item({ purchase_date: '2026-01-02T00:00:00Z', barcode: '0123' })} />)
    expect(screen.getByText(/Purchased:/)).toBeInTheDocument()
    expect(screen.getByText('0123')).toBeInTheDocument()
  })

  it('warns about matched household allergens', async () => {
    mockCheck.mockReturnValue(['peanuts'])
    render(<InventoryItemCard item={item({ ingredients: 'peanut butter' })} />)
    expect(await screen.findByText('Allergen Warning')).toBeInTheDocument()
    expect(screen.getByText('Household:')).toBeInTheDocument()
    expect(screen.getByText('peanuts')).toBeInTheDocument()
  })

  it('warns about product allergens parsed from nutritional_info', async () => {
    render(
      <InventoryItemCard
        item={item({ nutritional_info: JSON.stringify({ allergens: 'milk, soy' }) })}
      />
    )
    expect(await screen.findByText('Allergen Warning')).toBeInTheDocument()
    expect(screen.getByText('Product:')).toBeInTheDocument()
    expect(screen.getByText('milk, soy')).toBeInTheDocument()
  })

  it('ignores invalid nutritional_info JSON when computing allergens', () => {
    render(<InventoryItemCard item={item({ nutritional_info: 'not json' })} />)
    expect(screen.queryByText('Allergen Warning')).not.toBeInTheDocument()
  })

  it('toggles the ingredients section', () => {
    render(<InventoryItemCard item={item({ ingredients: 'water, sugar' })} />)
    expect(screen.queryByText('water, sugar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ingredients/ }))
    expect(screen.getByText('water, sugar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ingredients/ }))
    expect(screen.queryByText('water, sugar')).not.toBeInTheDocument()
  })

  it.each([
    ['a'],
    ['b'],
    ['c'],
    ['d'],
    ['e'],
  ])('toggles nutrition info and renders the %s grade styling', (grade) => {
    render(
      <InventoryItemCard
        item={item({
          nutritional_info: JSON.stringify({ nutrition_grade: grade, serving_size: '30g' }),
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Nutrition Info/ }))
    expect(screen.getByText('Nutrition Grade:')).toBeInTheDocument()
    expect(screen.getByText(grade)).toBeInTheDocument()
    expect(screen.getByText('30g')).toBeInTheDocument()
  })

  it('renders the allergens line inside the nutrition section', () => {
    render(<InventoryItemCard item={item({ nutritional_info: JSON.stringify({ allergens: 'soy' }) })} />)
    fireEvent.click(screen.getByRole('button', { name: /Nutrition Info/ }))
    // "soy" shows both in the top warning banner and the nutrition detail line.
    expect(screen.getAllByText('soy').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Allergens:')).toBeInTheDocument()
  })

  it('shows an invalid-data message when nutrition JSON cannot be parsed at render time', async () => {
    // Valid for the allergen pre-parse, then mutate so the render-time JSON.parse fails.
    const it1 = item({ nutritional_info: JSON.stringify({ foo: 1 }) })
    render(<InventoryItemCard item={it1} />)
    it1.nutritional_info = '{bad'
    fireEvent.click(screen.getByRole('button', { name: /Nutrition Info/ }))
    expect(screen.getByText('Invalid nutrition data')).toBeInTheDocument()
  })

  // The whole card is opened via a real <button> stretched over it (native
  // keyboard support, no role/tabIndex). It carries an accessible label.
  const getCardButton = (name: string) =>
    screen.getByRole('button', { name: new RegExp(`view details for ${name}`, 'i') })

  it('invokes onClick when the card action is activated', () => {
    const onClick = vi.fn()
    render(<InventoryItemCard item={item({ name: 'Milk' })} onClick={onClick} />)
    fireEvent.click(getCardButton('Milk'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onClick when an action button is clicked', () => {
    const onClick = vi.fn()
    const onEdit = vi.fn()
    render(<InventoryItemCard item={item({ name: 'Milk' })} onClick={onClick} onEdit={onEdit} />)
    fireEvent.click(screen.getByTitle('Edit item'))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('exposes an accessible label on the card action', () => {
    render(<InventoryItemCard item={item({ name: 'Milk' })} onClick={vi.fn()} />)
    expect(getCardButton('Milk')).toBeInTheDocument()
  })

  it('renders no card action button without an onClick handler', () => {
    render(<InventoryItemCard item={item({ name: 'Milk' })} />)
    expect(
      screen.queryByRole('button', { name: /view details for milk/i })
    ).not.toBeInTheDocument()
  })
})
