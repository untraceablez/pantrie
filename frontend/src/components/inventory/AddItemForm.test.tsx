import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AddItemForm from './AddItemForm'
import * as inventorySvc from '@/services/inventory'
import * as barcodeSvc from '@/services/barcode'
import * as householdSvc from '@/services/household'
import * as locationSvc from '@/services/location'
import * as allergenHooks from '@/hooks/useAllergenWarnings'
import { useAuthStore } from '@/store/authStore'

vi.mock('@/services/inventory', () => ({ createItem: vi.fn() }))
vi.mock('@/services/barcode', () => ({
  lookupBarcode: vi.fn(),
  lookupProduct: vi.fn(),
  searchProducts: vi.fn(),
}))
vi.mock('@/services/household', () => ({ listHouseholds: vi.fn(), createHousehold: vi.fn() }))
vi.mock('@/services/location', () => ({ listHouseholdLocations: vi.fn() }))
vi.mock('@/store/authStore', () => ({ useAuthStore: vi.fn() }))
// Allergen matching is the backend's job; the form only renders the result.
vi.mock('@/hooks/useAllergenWarnings', () => ({ useTextAllergenWarnings: vi.fn() }))

// Lightweight scanner stub exposing the scan/close callbacks as buttons.
vi.mock('@/components/barcode/BarcodeScanner', () => ({
  default: ({ onScan, onClose }: { onScan: (b: string) => void; onClose: () => void }) => (
    <div data-testid="scanner">
      <button onClick={() => onScan('555')}>fake-scan</button>
      <button onClick={onClose}>fake-close</button>
    </div>
  ),
}))

const mockCreateItem = vi.mocked(inventorySvc.createItem)
const mockLookup = vi.mocked(barcodeSvc.lookupBarcode)
const mockLookupProduct = vi.mocked(barcodeSvc.lookupProduct)
const mockSearch = vi.mocked(barcodeSvc.searchProducts)
const mockListHouseholds = vi.mocked(householdSvc.listHouseholds)
const mockCreateHousehold = vi.mocked(householdSvc.createHousehold)
const mockListLocations = vi.mocked(locationSvc.listHouseholdLocations)
const mockAuth = vi.mocked(useAuthStore)
const mockAllergenWarnings = vi.mocked(allergenHooks.useTextAllergenWarnings)

const household = (over: Partial<householdSvc.HouseholdWithRole> = {}): householdSvc.HouseholdWithRole =>
  ({ id: 1, name: 'Home', user_role: 'admin', ...over }) as householdSvc.HouseholdWithRole

const product = (over: Partial<barcodeSvc.ProductInfo> = {}): barcodeSvc.ProductInfo =>
  ({
    name: 'Cereal',
    description: 'Crunchy',
    brand: 'Acme',
    categories: [],
    image_url: null,
    quantity: null,
    serving_size: null,
    ingredients: null,
    allergens: null,
    nutrition_grade: null,
    nutrition_facts: null,
    labels: [],
    stores: null,
    countries: null,
    source: 'off',
    source_url: '',
    ...over,
  }) as barcodeSvc.ProductInfo

const suggestion = (
  over: Partial<barcodeSvc.ProductSuggestion> = {}
): barcodeSvc.ProductSuggestion => ({
  source: 'off',
  source_label: 'Open Food Facts',
  id: '111',
  barcode: '111',
  name: 'Organic Peanut Butter',
  brand: 'Acme',
  image_url: 'http://x/p.png',
  ...over,
})

const group = (
  over: Partial<barcodeSvc.ProductSearchGroup> = {}
): barcodeSvc.ProductSearchGroup => ({
  source: 'off',
  label: 'Open Food Facts',
  results: [suggestion()],
  search_url: 'http://off/search?q=peanut',
  ...over,
})

/** A search result with no hits from any source. */
const noHits = (search_url = 'http://off/search'): barcodeSvc.ProductSearchResult => ({
  groups: [],
  results: [],
  search_url,
})

const imgFile = (over: { type?: string; size?: number } = {}) => {
  const f = new File(['data'], 'photo.png', { type: over.type ?? 'image/png' })
  if (over.size !== undefined) Object.defineProperty(f, 'size', { value: over.size })
  return f
}

const renderForm = () => render(<AddItemForm onSuccess={vi.fn()} onCancel={vi.fn()} />)

describe('AddItemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAuth.mockReturnValue({ user: { id: 1, email: 'a@b.c' } } as ReturnType<typeof useAuthStore>)
    mockListHouseholds.mockResolvedValue([household()])
    mockListLocations.mockResolvedValue([])
    mockCreateItem.mockResolvedValue({} as inventorySvc.InventoryItem)
    mockSearch.mockResolvedValue(noHits())
    mockAllergenWarnings.mockReturnValue([])
  })

  it('lets ingredients be typed in for a manual add and submits them', async () => {
    renderForm()
    fireEvent.change(await screen.findByLabelText('Item Name *'), {
      target: { value: 'Cookies' },
    })
    fireEvent.change(screen.getByLabelText('Ingredients'), {
      target: { value: 'Wheat flour, whole milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    await waitFor(() =>
      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({ ingredients: 'Wheat flour, whole milk' })
      )
    )
  })

  it('warns when the entered ingredients match a household allergen', async () => {
    mockAllergenWarnings.mockReturnValue(['peanuts'])
    renderForm()
    fireEvent.change(await screen.findByLabelText('Ingredients'), {
      target: { value: 'Roasted peanuts, salt' },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('peanuts')
    expect(mockAllergenWarnings).toHaveBeenCalledWith(1, 'Roasted peanuts, salt')
  })

  it('shows no allergen warning when nothing matches', async () => {
    renderForm()
    fireEvent.change(await screen.findByLabelText('Ingredients'), {
      target: { value: 'Rice' },
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('loads households and defaults to the first', async () => {
    renderForm()
    expect(screen.getByText('Loading households...')).toBeInTheDocument()
    await waitFor(() => expect(mockListHouseholds).toHaveBeenCalled())
    expect(await screen.findByLabelText('Item Name *')).toBeInTheDocument()
  })

  it('does not fetch households when there is no user', async () => {
    mockAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuthStore>)
    renderForm()
    await waitFor(() => expect(mockListHouseholds).not.toHaveBeenCalled())
  })

  it('logs an error and shows the empty state if household loading fails', async () => {
    mockListHouseholds.mockRejectedValue(new Error('down'))
    renderForm()
    // The error banner only renders once a household exists, so the load
    // failure falls back to the no-household view; the error path still runs.
    expect(await screen.findByText('No Household Found')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('Error fetching households:', expect.any(Error))
  })

  it('offers household creation when the user has none, and creates one', async () => {
    mockListHouseholds.mockResolvedValueOnce([]).mockResolvedValueOnce([household()])
    mockCreateHousehold.mockResolvedValue(household())
    renderForm()
    const createBtn = await screen.findByRole('button', { name: 'Create My Household' })
    fireEvent.click(createBtn)
    await waitFor(() => expect(mockCreateHousehold).toHaveBeenCalled())
    expect(await screen.findByLabelText('Item Name *')).toBeInTheDocument()
  })

  it('logs an error when household creation fails and stays on the create view', async () => {
    mockListHouseholds.mockResolvedValue([])
    mockCreateHousehold.mockRejectedValue({ response: { data: { error: 'nope' } } })
    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Create My Household' }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error creating household:', expect.anything())
    )
    // Still no household, so the create button is back (not "Creating...").
    expect(await screen.findByRole('button', { name: 'Create My Household' })).toBeInTheDocument()
  })

  it('renders a household selector when there are multiple households', async () => {
    mockListHouseholds.mockResolvedValue([household(), household({ id: 2, name: 'Cabin', user_role: 'editor' })])
    renderForm()
    const select = (await screen.findByLabelText('Household *')) as HTMLSelectElement
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: '2' } })
    expect(select.value).toBe('2')
  })

  it('loads locations for the active household', async () => {
    mockListLocations.mockResolvedValue([
      { id: 9, household_id: 1, name: 'Pantry', icon: '🥫', created_at: '', updated_at: '' } as locationSvc.Location,
    ])
    renderForm()
    expect(await screen.findByRole('option', { name: '🥫 Pantry' })).toBeInTheDocument()
    await waitFor(() => expect(mockListLocations).toHaveBeenCalledWith(1))
  })

  it('logs but does not surface a locations load error', async () => {
    mockListLocations.mockRejectedValue(new Error('loc'))
    renderForm()
    await screen.findByLabelText('Item Name *')
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error fetching locations:', expect.any(Error))
    )
    expect(screen.queryByText('loc')).not.toBeInTheDocument()
  })

  it('warns when expiration is before purchase, when expired, and clears otherwise', async () => {
    renderForm()
    const purchase = await screen.findByLabelText('Purchase Date')
    const expiration = screen.getByLabelText('Expiration Date')

    fireEvent.change(purchase, { target: { value: '2020-01-01' } })
    fireEvent.change(expiration, { target: { value: '2019-01-01' } }) // before purchase
    expect(await screen.findByText(/before the purchase date/)).toBeInTheDocument()

    fireEvent.change(expiration, { target: { value: '2021-01-01' } }) // after purchase, before today
    expect(await screen.findByText('⚠️ Warning: This item is expired!')).toBeInTheDocument()

    fireEvent.change(expiration, { target: { value: '2999-01-01' } }) // future → no warning
    await waitFor(() => expect(screen.queryByText(/expired/)).not.toBeInTheDocument())
  })

  it('warns about an expired item when only an expiration date is set', async () => {
    renderForm()
    const purchase = await screen.findByLabelText('Purchase Date')
    fireEvent.change(purchase, { target: { value: '' } })
    const expiration = screen.getByLabelText('Expiration Date')
    fireEvent.change(expiration, { target: { value: '2020-01-01' } })
    expect(await screen.findByText('⚠️ Warning: This item is expired!')).toBeInTheDocument()
    // A future-only expiration clears the warning.
    fireEvent.change(expiration, { target: { value: '2999-01-01' } })
    await waitFor(() => expect(screen.queryByText(/expired/)).not.toBeInTheDocument())
  })

  it('looks up a barcode manually and fills in the form + product indicators', async () => {
    mockLookup.mockResolvedValue(
      product({
        name: 'Cereal',
        image_url: 'http://x/c.png',
        ingredients: 'oats, sugar',
        nutrition_grade: 'b',
        serving_size: '40g',
        allergens: 'gluten',
      })
    )
    renderForm()
    const input = await screen.findByPlaceholderText('Enter or scan barcode here')
    fireEvent.change(input, { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }))

    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('12345'))
    expect(await screen.findByText('✓ Product found! Details have been filled in.')).toBeInTheDocument()
    expect((screen.getByLabelText('Item Name *') as HTMLInputElement).value).toBe('Cereal')
    expect((screen.getByAltText('Preview') as HTMLImageElement).src).toBe('http://x/c.png')
  })

  it('looks up via the Enter key', async () => {
    mockLookup.mockResolvedValue(product())
    renderForm()
    const input = await screen.findByPlaceholderText('Enter or scan barcode here')
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('999'))
  })

  it('shows a 404-specific message when the product is unknown', async () => {
    mockLookup.mockRejectedValue({ response: { status: 404 } })
    renderForm()
    const input = await screen.findByPlaceholderText('Enter or scan barcode here')
    fireEvent.change(input, { target: { value: '404' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }))
    expect(await screen.findByText(/Product not found in database/)).toBeInTheDocument()
  })

  it('shows a generic message for other lookup failures', async () => {
    mockLookup.mockRejectedValue({ response: { status: 500 } })
    renderForm()
    const input = await screen.findByPlaceholderText('Enter or scan barcode here')
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }))
    expect(await screen.findByText(/Failed to lookup product/)).toBeInTheDocument()
  })

  it('scans a barcode through the camera scanner', async () => {
    mockLookup.mockResolvedValue(product())
    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Camera' }))
    expect(screen.getByTestId('scanner')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'fake-scan' }))
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('555'))
    expect(screen.queryByTestId('scanner')).not.toBeInTheDocument()
  })

  it('closes the scanner without scanning', async () => {
    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Camera' }))
    fireEvent.click(screen.getByRole('button', { name: 'fake-close' }))
    expect(screen.queryByTestId('scanner')).not.toBeInTheDocument()
  })

  it('searches by product name and fills the form from a chosen suggestion', async () => {
    mockSearch.mockResolvedValue({
      groups: [
        group({
          results: [
            suggestion(),
            suggestion({ id: '222', barcode: '222', name: 'Peanut Butter Lite', brand: null, image_url: null }),
          ],
        }),
      ],
      results: [],
      search_url: 'http://off/search?q=peanut',
    })
    mockLookupProduct.mockResolvedValue(product({ name: 'Organic Peanut Butter' }))
    renderForm()

    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    fireEvent.change(input, { target: { value: 'peanut butter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('peanut butter'))
    fireEvent.click(await screen.findByText('Organic Peanut Butter'))

    // Choosing a suggestion looks it up in the source it came from, and fills the form.
    await waitFor(() => expect(mockLookupProduct).toHaveBeenCalledWith('off', '111'))
    expect((screen.getByLabelText('Item Name *') as HTMLInputElement).value).toBe('Organic Peanut Butter')
    // A suggestion with a barcode also populates the barcode field.
    expect(
      (screen.getByPlaceholderText('Enter or scan barcode here') as HTMLInputElement).value
    ).toBe('111')
  })

  it('groups suggestions by source, each with its own see-more link', async () => {
    mockSearch.mockResolvedValue({
      groups: [
        group(),
        group({
          source: 'usda',
          label: 'USDA FoodData Central',
          results: [
            suggestion({
              source: 'usda',
              source_label: 'USDA FoodData Central',
              id: '999',
              barcode: null,
              name: 'Peanuts, Raw',
              brand: null,
              image_url: null,
            }),
          ],
          search_url: 'http://fdc/search?q=peanut',
        }),
      ],
      results: [],
      search_url: 'http://off/search?q=peanut',
    })
    renderForm()

    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    fireEvent.change(input, { target: { value: 'peanut' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    // Each source gets a heading and a link pointing at that source's results.
    expect(await screen.findByText('Open Food Facts')).toBeInTheDocument()
    expect(screen.getByText('USDA FoodData Central')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /See more results on Open Food Facts/ })
    ).toHaveAttribute('href', 'http://off/search?q=peanut')
    expect(
      screen.getByRole('link', { name: /See more results on USDA FoodData Central/ })
    ).toHaveAttribute('href', 'http://fdc/search?q=peanut')
    // The generic no-matches fallback stays hidden while there are hits.
    expect(screen.queryByText(/No quick matches/)).not.toBeInTheDocument()
  })

  it('leaves the barcode field empty for a suggestion that has no barcode', async () => {
    mockSearch.mockResolvedValue({
      groups: [
        group({
          source: 'usda',
          label: 'USDA FoodData Central',
          results: [
            suggestion({
              source: 'usda',
              id: '999',
              barcode: null,
              name: 'Peanuts, Raw',
              image_url: null,
            }),
          ],
        }),
      ],
      results: [],
      search_url: 'http://off/search',
    })
    mockLookupProduct.mockResolvedValue(product({ name: 'Peanuts, Raw' }))
    renderForm()

    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    fireEvent.change(input, { target: { value: 'peanuts' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.click(await screen.findByText('Peanuts, Raw'))

    await waitFor(() => expect(mockLookupProduct).toHaveBeenCalledWith('usda', '999'))
    expect(
      (screen.getByPlaceholderText('Enter or scan barcode here') as HTMLInputElement).value
    ).toBe('')
    expect((screen.getByLabelText('Item Name *') as HTMLInputElement).value).toBe('Peanuts, Raw')
  })

  it('searches via the Enter key', async () => {
    mockSearch.mockResolvedValue(noHits('http://off/s'))
    renderForm()
    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    fireEvent.change(input, { target: { value: 'beans' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('beans'))
  })

  it('shows the no-matches state with a link to full results', async () => {
    mockSearch.mockResolvedValue(noHits('http://off/search?q=zzz'))
    renderForm()
    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText(/No quick matches/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /See more results on Open Food Facts/ })
    expect(link).toHaveAttribute('href', 'http://off/search?q=zzz')
  })

  it('disables Search for a too-short query and surfaces a search error', async () => {
    renderForm()
    const input = await screen.findByPlaceholderText('e.g. organic peanut butter')
    const button = screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement
    fireEvent.change(input, { target: { value: 'a' } })
    expect(button.disabled).toBe(true)

    mockSearch.mockRejectedValue(new Error('network'))
    fireEvent.change(input, { target: { value: 'apples' } })
    fireEvent.click(button)
    expect(await screen.findByText('Failed to search products. Please try again.')).toBeInTheDocument()
  })

  it('validates image file type and size', async () => {
    renderForm()
    await screen.findByLabelText('Item Name *')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [imgFile({ type: 'text/plain' })] } })
    expect(screen.getByText('Please select a valid image file')).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [imgFile({ size: 11 * 1024 * 1024 })] } })
    expect(screen.getByText('Image size must be less than 10MB')).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [] } }) // no-op
  })

  it('previews an uploaded image and removes it', async () => {
    renderForm()
    await screen.findByLabelText('Item Name *')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [imgFile()] } })
    await waitFor(() => expect(screen.getByAltText('Preview')).toBeInTheDocument())
    expect((screen.getByPlaceholderText('https://example.com/image.jpg') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByTitle('Remove image'))
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
  })

  it('previews from an image URL then clears it', async () => {
    renderForm()
    const url = (await screen.findByPlaceholderText('https://example.com/image.jpg')) as HTMLInputElement
    fireEvent.change(url, { target: { value: 'http://x/u.png' } })
    expect((screen.getByAltText('Preview') as HTMLImageElement).src).toBe('http://x/u.png')
    fireEvent.change(url, { target: { value: '' } })
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
  })

  it('selects a location and clears it back to none', async () => {
    mockListLocations.mockResolvedValue([
      { id: 9, household_id: 1, name: 'Pantry', icon: null, created_at: '', updated_at: '' } as locationSvc.Location,
    ])
    renderForm()
    const select = (await screen.findByLabelText('Location')) as HTMLSelectElement
    await screen.findByRole('option', { name: 'Pantry' })
    fireEvent.change(select, { target: { value: '9' } })
    expect(select.value).toBe('9')
    fireEvent.change(select, { target: { value: '' } })
    expect(select.value).toBe('')
  })

  it('blocks submit when no household is selected', async () => {
    mockListHouseholds.mockResolvedValue([household(), household({ id: 2, name: 'Cabin', user_role: 'editor' })])
    renderForm()
    const select = (await screen.findByLabelText('Household *')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '' } }) // deselect → householdId becomes 0
    fireEvent.submit(select.closest('form')!)
    expect(await screen.findByText('Please select a household')).toBeInTheDocument()
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('requires a quantity greater than 0', async () => {
    renderForm()
    const qty = await screen.findByLabelText('Quantity *')
    fireEvent.change(qty, { target: { value: '0' } })
    fireEvent.submit(qty.closest('form')!)
    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument()
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('submits the new item and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    render(<AddItemForm onSuccess={onSuccess} onCancel={vi.fn()} />)
    const name = await screen.findByLabelText('Item Name *')
    fireEvent.change(name, { target: { value: 'Beans' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalled())
    expect(mockCreateItem.mock.calls[0][0]).toMatchObject({ household_id: 1, name: 'Beans', quantity: 1 })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('converts an uploaded image to base64 on submit', async () => {
    render(<AddItemForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const name = await screen.findByLabelText('Item Name *')
    fireEvent.change(name, { target: { value: 'Beans' } })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [imgFile()] } })
    await waitFor(() => expect(screen.getByAltText('Preview')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalled())
    expect((mockCreateItem.mock.calls[0][0] as { image_url: string }).image_url).toMatch(/^data:/)
  })

  it('shows a server error if item creation fails', async () => {
    mockCreateItem.mockRejectedValue({ response: { data: { error: 'dup item' } } })
    render(<AddItemForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const name = await screen.findByLabelText('Item Name *')
    fireEvent.change(name, { target: { value: 'Beans' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(await screen.findByText('dup item')).toBeInTheDocument()
  })

  it('falls back to a generic message when item creation has no error detail', async () => {
    mockCreateItem.mockRejectedValue(new Error('boom'))
    render(<AddItemForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const name = await screen.findByLabelText('Item Name *')
    fireEvent.change(name, { target: { value: 'Beans' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(await screen.findByText('Failed to create item. Please try again.')).toBeInTheDocument()
  })

  it('cancels via both cancel buttons', async () => {
    const onCancel = vi.fn()
    // With a household present.
    const { unmount } = render(<AddItemForm onSuccess={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    unmount()

    // With no household, the standalone cancel button is shown.
    mockListHouseholds.mockResolvedValue([])
    render(<AddItemForm onSuccess={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
