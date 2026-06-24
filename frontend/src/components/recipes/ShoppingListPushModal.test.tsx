import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ShoppingListPushModal from './ShoppingListPushModal'
import * as mealieSvc from '@/services/mealie'
import type { RecipeMakeability } from '@/services/mealie'

vi.mock('@/services/mealie', () => ({
  listShoppingLists: vi.fn(),
  pushToShoppingList: vi.fn(),
}))

const mockListLists = vi.mocked(mealieSvc.listShoppingLists)
const mockPush = vi.mocked(mealieSvc.pushToShoppingList)

const recipe = (over: Partial<RecipeMakeability> = {}): RecipeMakeability => ({
  recipe_id: 'r1',
  name: 'Chana Masala',
  makeable: false,
  total_ingredients: 3,
  available_ingredients: 1,
  missing: ['chickpeas', 'cumin'],
  ...over,
})

const pushResult = { added: 2, requested: 2, updated: 0, items: [] }

describe('ShoppingListPushModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListLists.mockResolvedValue([])
    mockPush.mockResolvedValue(pushResult as Awaited<ReturnType<typeof mealieSvc.pushToShoppingList>>)
  })

  it('loads lists and defaults to the first existing one', async () => {
    mockListLists.mockResolvedValue([
      { id: 'l1', name: 'Weekly' },
      { id: 'l2', name: 'Costco' },
    ])
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={vi.fn()} />)
    const select = (await screen.findByLabelText('Shopping list')) as HTMLSelectElement
    expect(select.value).toBe('l1')
    expect(screen.getByText('Adding 2 missing ingredients from', { exact: false })).toBeInTheDocument()
  })

  it('pushes to a chosen existing list', async () => {
    const onPushed = vi.fn()
    mockListLists.mockResolvedValue([
      { id: 'l1', name: 'Weekly' },
      { id: 'l2', name: 'Costco' },
    ])
    const r = recipe()
    render(<ShoppingListPushModal householdId={1} recipe={r} onClose={vi.fn()} onPushed={onPushed} />)
    const select = (await screen.findByLabelText('Shopping list')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'l2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(1, ['chickpeas', 'cumin'], { listId: 'l2' })
    )
    expect(onPushed).toHaveBeenCalledWith(r, pushResult)
  })

  it('pre-fills a new list name with "<Recipe> - DD-MM-YY" and creates it on push', async () => {
    const onPushed = vi.fn()
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={onPushed} />)
    // No existing lists, so the create-new field is shown by default.
    const input = (await screen.findByLabelText('New list name')) as HTMLInputElement
    expect(input.value).toMatch(/^Chana Masala - \d{2}-\d{2}-\d{2}$/)

    fireEvent.change(input, { target: { value: 'Cook night' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(1, ['chickpeas', 'cumin'], { createListName: 'Cook night' })
    )
    expect(onPushed).toHaveBeenCalled()
  })

  it('switches an existing-list selection to create-new', async () => {
    mockListLists.mockResolvedValue([{ id: 'l1', name: 'Weekly' }])
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={vi.fn()} />)
    const select = (await screen.findByLabelText('Shopping list')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'new' } })
    expect(screen.getByLabelText('New list name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(1, ['chickpeas', 'cumin'], expect.objectContaining({ createListName: expect.any(String) }))
    )
  })

  it('disables the push button when the new list name is blank', async () => {
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={vi.fn()} />)
    const input = (await screen.findByLabelText('New list name')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    expect((screen.getByRole('button', { name: 'Add to list' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an error when lists fail to load', async () => {
    mockListLists.mockRejectedValue(new Error('boom'))
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={vi.fn()} />)
    expect(await screen.findByText('Failed to load shopping lists')).toBeInTheDocument()
  })

  it('uses singular wording for a single missing ingredient', async () => {
    render(
      <ShoppingListPushModal
        householdId={1}
        recipe={recipe({ missing: ['cumin'] })}
        onClose={vi.fn()}
        onPushed={vi.fn()}
      />
    )
    expect(
      await screen.findByText('Adding 1 missing ingredient from', { exact: false })
    ).toBeInTheDocument()
  })

  it('shows an error when the push fails', async () => {
    mockPush.mockRejectedValue(new Error('nope'))
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={vi.fn()} onPushed={vi.fn()} />)
    await screen.findByLabelText('New list name')
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    expect(await screen.findByText('Failed to update the Mealie shopping list')).toBeInTheDocument()
  })

  it('closes via Cancel and the header X', async () => {
    const onClose = vi.fn()
    render(<ShoppingListPushModal householdId={1} recipe={recipe()} onClose={onClose} onPushed={vi.fn()} />)
    await screen.findByLabelText('New list name')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
