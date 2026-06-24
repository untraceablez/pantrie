import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Recipes from './Recipes'
import * as householdSvc from '@/services/household'
import * as mealieSvc from '@/services/mealie'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/household', () => ({ listHouseholds: vi.fn() }))
vi.mock('@/services/mealie', () => ({ getMealieRecipes: vi.fn() }))

// Stub the push modal; the page just opens it and reacts to onPushed/onClose.
vi.mock('@/components/recipes/ShoppingListPushModal', () => ({
  default: ({ recipe, onClose, onPushed }: any) => (
    <div data-testid="push-modal">
      <span>modal for {recipe.name}</span>
      <button onClick={() => onPushed(recipe, { added: 2, requested: 2, updated: 1, items: [] })}>
        do-push
      </button>
      <button onClick={() => onPushed(recipe, { added: 2, requested: 2, updated: 0, items: [] })}>
        do-push-plain
      </button>
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}))

const mockListHouseholds = vi.mocked(householdSvc.listHouseholds)
const mockGetRecipes = vi.mocked(mealieSvc.getMealieRecipes)

const household = (over: Partial<householdSvc.HouseholdWithRole> = {}): householdSvc.HouseholdWithRole =>
  ({ id: 1, name: 'Home', user_role: 'admin', ...over }) as householdSvc.HouseholdWithRole

const recipe = (over: Partial<mealieSvc.RecipeMakeability> = {}): mealieSvc.RecipeMakeability => ({
  recipe_id: 'r1',
  name: 'Pancakes',
  makeable: true,
  total_ingredients: 3,
  available_ingredients: 3,
  missing: [],
  ...over,
})

describe('Recipes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockListHouseholds.mockResolvedValue([household()])
    mockGetRecipes.mockResolvedValue({ recipes: [] })
  })

  it('loads recipes and renders makeable and missing states', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [
        recipe({ recipe_id: 'a', name: 'Pancakes', makeable: true }),
        recipe({
          recipe_id: 'b',
          name: 'Omelette',
          makeable: false,
          available_ingredients: 1,
          total_ingredients: 3,
          missing: ['eggs', 'cheese'],
        }),
      ],
    })
    render(<Recipes />)
    expect(await screen.findByText('Pancakes')).toBeInTheDocument()
    expect(screen.getByText('Can make')).toBeInTheDocument()
    expect(screen.getByText('Missing 2')).toBeInTheDocument()
    expect(screen.getByText('1/3 ingredients in stock')).toBeInTheDocument()
    expect(screen.getByText('Missing: eggs, cheese')).toBeInTheDocument()
    await waitFor(() => expect(mockGetRecipes).toHaveBeenCalledWith(1))
  })

  it('shows an empty state when there are no recipes', async () => {
    mockGetRecipes.mockResolvedValue({ recipes: [] })
    render(<Recipes />)
    expect(await screen.findByText('No recipes found in your Mealie instance.')).toBeInTheDocument()
  })

  it('shows the no-Mealie message on a 404', async () => {
    mockGetRecipes.mockRejectedValue({ response: { status: 404 } })
    render(<Recipes />)
    expect(await screen.findByText(/No Mealie connection configured/)).toBeInTheDocument()
  })

  it('shows a generic error on other recipe failures', async () => {
    mockGetRecipes.mockRejectedValue({ response: { status: 500 } })
    render(<Recipes />)
    expect(await screen.findByText(/Failed to load recipes from Mealie/)).toBeInTheDocument()
  })

  it('shows an error when households fail to load', async () => {
    mockListHouseholds.mockRejectedValue(new Error('down'))
    render(<Recipes />)
    expect(await screen.findByText('Failed to load households')).toBeInTheDocument()
  })

  it('renders a household selector with multiple households and switches', async () => {
    mockListHouseholds.mockResolvedValue([household(), household({ id: 2, name: 'Cabin' })])
    render(<Recipes />)
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: '2' } })
    await waitFor(() => expect(mockGetRecipes).toHaveBeenCalledWith(2))
  })

  it('opens the push modal and shows a notice (with updated count) on success', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [recipe({ name: 'Omelette', makeable: false, missing: ['eggs'] })],
    })
    render(<Recipes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add missing to Mealie list' }))
    expect(await screen.findByTestId('push-modal')).toHaveTextContent('modal for Omelette')

    fireEvent.click(screen.getByRole('button', { name: 'do-push' }))
    expect(
      await screen.findByText('Omelette: added 2/2 to Mealie shopping list (1 updated)')
    ).toBeInTheDocument()
    // The modal closes after a successful push.
    expect(screen.queryByTestId('push-modal')).not.toBeInTheDocument()
  })

  it('omits the updated count when nothing was incremented', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [recipe({ name: 'Omelette', makeable: false, missing: ['eggs'] })],
    })
    render(<Recipes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add missing to Mealie list' }))
    fireEvent.click(await screen.findByRole('button', { name: 'do-push-plain' }))
    expect(
      await screen.findByText('Omelette: added 2/2 to Mealie shopping list')
    ).toBeInTheDocument()
  })

  it('closes the push modal without pushing', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [recipe({ name: 'Omelette', makeable: false, missing: ['eggs'] })],
    })
    render(<Recipes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add missing to Mealie list' }))
    fireEvent.click(await screen.findByRole('button', { name: 'close-modal' }))
    expect(screen.queryByTestId('push-modal')).not.toBeInTheDocument()
  })

  it('renders nothing extra when the user has no households', async () => {
    mockListHouseholds.mockResolvedValue([])
    render(<Recipes />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    expect(mockGetRecipes).not.toHaveBeenCalled()
    expect(screen.queryByText('No recipes found in your Mealie instance.')).not.toBeInTheDocument()
  })

  it('navigates back to the dashboard and honors the dark logo', async () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    render(<Recipes />)
    expect((screen.getByAltText('Pantrie') as HTMLImageElement).src).toContain('/pantrie-logo-light.png')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Inventory' }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })
})
