import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import EditItemModal from './EditItemModal'
import * as inventorySvc from '@/services/inventory'
import * as locationSvc from '@/services/location'
import { type InventoryItem } from '@/services/inventory'

vi.mock('@/services/inventory', () => ({ updateItem: vi.fn() }))
vi.mock('@/services/location', () => ({ listHouseholdLocations: vi.fn() }))

const mockUpdate = vi.mocked(inventorySvc.updateItem)
const mockListLocations = vi.mocked(locationSvc.listHouseholdLocations)

const item = (over: Partial<InventoryItem> = {}): InventoryItem =>
  ({
    id: 5,
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

const loc = (over: Partial<locationSvc.Location> = {}): locationSvc.Location =>
  ({ id: 1, household_id: 7, name: 'Pantry', icon: '🥫', created_at: '', updated_at: '', ...over }) as locationSvc.Location

const imgFile = (over: { type?: string; size?: number } = {}) => {
  const f = new File(['data'], 'photo.png', { type: over.type ?? 'image/png' })
  if (over.size !== undefined) Object.defineProperty(f, 'size', { value: over.size })
  return f
}

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement
const urlInput = () => screen.getByPlaceholderText('Or enter image URL') as HTMLInputElement

describe('EditItemModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockListLocations.mockResolvedValue([])
    mockUpdate.mockResolvedValue({} as InventoryItem)
  })

  it('seeds the form from the item and loads locations', async () => {
    mockListLocations.mockResolvedValue([loc(), loc({ id: 2, name: 'Fridge', icon: null })])
    render(<EditItemModal item={item({ name: 'Milk' })} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect((screen.getByLabelText('Name *') as HTMLInputElement).value).toBe('Milk')
    await waitFor(() => expect(mockListLocations).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('option', { name: '🥫 Pantry' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Fridge' })).toBeInTheDocument()
  })

  it('logs an error when location loading fails', async () => {
    mockListLocations.mockRejectedValue(new Error('boom'))
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error fetching locations:', expect.any(Error))
    )
  })

  it('shows the existing image preview and removes it', () => {
    render(<EditItemModal item={item({ image_url: 'http://x/i.png' })} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByAltText('Preview')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Remove image'))
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
  })

  it('validates name is required', async () => {
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('validates quantity must be greater than 0', async () => {
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    const qty = screen.getByLabelText('Quantity *')
    fireEvent.change(qty, { target: { value: '0' } })
    // Submit the form directly — jsdom would otherwise block on the min="0.01" constraint.
    fireEvent.submit(qty.closest('form')!)
    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('submits trimmed/normalized values and calls onSuccess + onClose', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    render(
      <EditItemModal
        item={item({ name: 'Milk', quantity: 2 })}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    )
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' fresh ' } })
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: ' Acme ' } })
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'L' } })
    fireEvent.change(screen.getByLabelText('Purchase Date'), { target: { value: '2026-02-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    const [id, data] = mockUpdate.mock.calls[0]
    expect(id).toBe(5)
    expect(data).toMatchObject({
      name: 'Milk',
      description: 'fresh',
      brand: 'Acme',
      unit: 'L',
      quantity: 2,
      purchase_date: '2026-02-01',
      image_url: null,
    })
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('updates the location select to a chosen id and back to null', async () => {
    mockListLocations.mockResolvedValue([loc({ id: 3, name: 'Cellar', icon: null })])
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    const select = (await screen.findByLabelText('Location')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '3' } })
    expect(select.value).toBe('3')
    fireEvent.change(select, { target: { value: '' } })
    expect(select.value).toBe('')
  })

  it('rejects a non-image file', () => {
    const { container } = render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(fileInput(container), { target: { files: [imgFile({ type: 'text/plain' })] } })
    expect(screen.getByText('Please select a valid image file')).toBeInTheDocument()
  })

  it('rejects an oversized image', () => {
    const { container } = render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(fileInput(container), { target: { files: [imgFile({ size: 11 * 1024 * 1024 })] } })
    expect(screen.getByText('Image size must be less than 10MB')).toBeInTheDocument()
  })

  it('ignores a file change with no file selected', () => {
    const { container } = render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(fileInput(container), { target: { files: [] } })
    expect(screen.queryByText(/valid image file/)).not.toBeInTheDocument()
  })

  it('accepts a valid image, previews it, disables the URL field, and submits it as base64', async () => {
    const { container } = render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(fileInput(container), { target: { files: [imgFile()] } })
    await waitFor(() => expect(screen.getByAltText('Preview')).toBeInTheDocument())
    expect(screen.getByText('Change Photo')).toBeInTheDocument()
    expect(urlInput().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate.mock.calls[0][1].image_url).toMatch(/^data:/)
  })

  it('rejects the submit when reading the image file fails', async () => {
    // FileReader that errors on read, exercising the base64 promise reject path.
    class ErrorFileReader {
      onloadend: ((this: void) => void) | null = null
      onerror: ((err: unknown) => void) | null = null
      readAsDataURL() {
        this.onerror?.(new Error('read fail'))
      }
    }
    vi.stubGlobal('FileReader', ErrorFileReader)
    try {
      const { container } = render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
      fireEvent.change(fileInput(container), { target: { files: [imgFile()] } })
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(await screen.findByText('Failed to update item. Please try again.')).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sets a preview from an image URL, then clears it when emptied', () => {
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(urlInput(), { target: { value: 'http://x/y.png' } })
    expect((screen.getByAltText('Preview') as HTMLImageElement).src).toBe('http://x/y.png')
    fireEvent.change(urlInput(), { target: { value: '' } })
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
  })

  it('surfaces a server error message on submit failure', async () => {
    mockUpdate.mockRejectedValue({ response: { data: { error: 'Name taken' } } })
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Name taken')).toBeInTheDocument()
  })

  it('falls back to a generic error when none is provided', async () => {
    mockUpdate.mockRejectedValue(new Error('network'))
    render(<EditItemModal item={item()} onClose={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Failed to update item. Please try again.')).toBeInTheDocument()
  })

  it('closes via the header X and Cancel', () => {
    const onClose = vi.fn()
    render(<EditItemModal item={item()} onClose={onClose} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getAllByRole('button')[0]) // header X
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
