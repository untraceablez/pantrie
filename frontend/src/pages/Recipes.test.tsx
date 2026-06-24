import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Recipes from './Recipes'
import * as householdSvc from '@/services/household'
import * as mealieSvc from '@/services/mealie'
import { useThemeStore } from '@/store/themeStore'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/household', () => ({ listHouseholds: vi.fn() }))
vi.mock('@/services/mealie', () => ({ getMealieRecipes: vi.fn(), pushToShoppingList: vi.fn() }))

const mockListHouseholds = vi.mocked(householdSvc.listHouseholds)
const mockGetRecipes = vi.mocked(mealieSvc.getMealieRecipes)
const mockPush = vi.mocked(mealieSvc.pushToShoppingList)

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

  it('pushes missing ingredients to the shopping list and shows a notice', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [recipe({ name: 'Omelette', makeable: false, missing: ['eggs'] })],
    })
    mockPush.mockResolvedValue({ added: 1, requested: 1 } as Awaited<ReturnType<typeof mealieSvc.pushToShoppingList>>)
    render(<Recipes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add missing to Mealie list' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(1, ['eggs']))
    expect(await screen.findByText('Omelette: added 1/1 to Mealie shopping list')).toBeInTheDocument()
  })

  it('shows a failure notice when the push fails', async () => {
    mockGetRecipes.mockResolvedValue({
      recipes: [recipe({ name: 'Omelette', makeable: false, missing: ['eggs'] })],
    })
    mockPush.mockRejectedValue(new Error('nope'))
    render(<Recipes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add missing to Mealie list' }))
    expect(await screen.findByText('Omelette: failed to update Mealie shopping list')).toBeInTheDocument()
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
