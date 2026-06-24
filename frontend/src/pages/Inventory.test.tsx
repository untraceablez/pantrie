import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Inventory from './Inventory'
import * as inventorySvc from '@/services/inventory'
import * as householdSvc from '@/services/household'
import * as locationSvc from '@/services/location'
import * as authSvc from '@/services/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import type { InventoryItem, InventoryListResponse } from '@/services/inventory'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/inventory', () => ({ listInventory: vi.fn(), deleteItem: vi.fn() }))
vi.mock('@/services/household', () => ({ listHouseholds: vi.fn() }))
vi.mock('@/services/location', () => ({ listHouseholdLocations: vi.fn() }))
vi.mock('@/services/auth', () => ({ logout: vi.fn() }))

// Stub child components, surfacing their callbacks as buttons we can click.
vi.mock('@/components/inventory/SearchBar', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="search" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/inventory/InventoryList', () => ({
  default: ({ items, onEdit, onDelete, onItemClick, onSortChange, onPageChange }: any) => (
    <div data-testid="inventory-list">
      <span>count:{items.length}</span>
      <button onClick={() => onEdit(items[0])}>list-edit</button>
      <button onClick={() => onDelete(items[0])}>list-delete</button>
      <button onClick={() => onItemClick(items[0])}>list-view</button>
      <button onClick={() => onSortChange('created_at')}>sort-same</button>
      <button onClick={() => onSortChange('name')}>sort-other</button>
      <button onClick={() => onPageChange(2)}>page-2</button>
    </div>
  ),
}))
vi.mock('@/components/inventory/EditItemModal', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => (
    <div data-testid="edit-modal">
      <button onClick={onClose}>edit-close</button>
      <button onClick={onSuccess}>edit-success</button>
    </div>
  ),
}))
vi.mock('@/components/inventory/ItemDetailModal', () => ({
  default: ({ item, onClose, onEdit, onDelete }: any) => (
    <div data-testid="detail-modal">
      <button onClick={onClose}>detail-close</button>
      <button onClick={() => onEdit(item)}>detail-edit</button>
      <button onClick={() => onDelete(item)}>detail-delete</button>
    </div>
  ),
}))

const mockListInventory = vi.mocked(inventorySvc.listInventory)
const mockDeleteItem = vi.mocked(inventorySvc.deleteItem)
const mockListHouseholds = vi.mocked(householdSvc.listHouseholds)
const mockListLocations = vi.mocked(locationSvc.listHouseholdLocations)
const mockLogout = vi.mocked(authSvc.logout)

const item = (over: Partial<InventoryItem> = {}): InventoryItem =>
  ({ id: 1, household_id: 1, name: 'Milk', ...over }) as InventoryItem

const listResponse = (over: Partial<InventoryListResponse> = {}): InventoryListResponse => ({
  items: [item()],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
  ...over,
})

const household = (over: Partial<householdSvc.HouseholdWithRole> = {}): householdSvc.HouseholdWithRole =>
  ({ id: 1, name: 'Home', user_role: 'admin', ...over }) as householdSvc.HouseholdWithRole

describe('Inventory page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    useAuthStore.setState({ user: { id: 1, email: 'a@b.c' } as never, refreshToken: 'ref-1' })
    useThemeStore.setState({ resolvedTheme: 'light' })
    mockListHouseholds.mockResolvedValue([household()])
    mockListLocations.mockResolvedValue([])
    mockListInventory.mockResolvedValue(listResponse())
    mockLogout.mockResolvedValue()
  })

  it('loads households then inventory and renders the list', async () => {
    render(<Inventory />)
    expect(await screen.findByTestId('inventory-list')).toBeInTheDocument()
    expect(screen.getByText('count:1')).toBeInTheDocument()
    await waitFor(() => expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ page: 1 })))
  })

  it('shows "No household selected" when there is no user', async () => {
    useAuthStore.setState({ user: null })
    render(<Inventory />)
    expect(await screen.findByText('No household selected')).toBeInTheDocument()
    expect(mockListHouseholds).not.toHaveBeenCalled()
  })

  it('shows an error if households fail to load', async () => {
    mockListHouseholds.mockRejectedValue(new Error('down'))
    render(<Inventory />)
    expect(await screen.findByText('Failed to load households')).toBeInTheDocument()
  })

  it('renders location tabs and selects one, then back to All Items', async () => {
    mockListLocations.mockResolvedValue([
      { id: 5, household_id: 1, name: 'Pantry', icon: '🥫', created_at: '', updated_at: '' } as locationSvc.Location,
    ])
    render(<Inventory />)
    const pantry = await screen.findByRole('button', { name: /Pantry/ })
    fireEvent.click(pantry)
    await waitFor(() =>
      expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ location_id: 5 }))
    )
    fireEvent.click(screen.getByRole('button', { name: 'All Items' }))
  })

  it('logs but does not surface a locations load error', async () => {
    mockListLocations.mockRejectedValue(new Error('loc down'))
    render(<Inventory />)
    await screen.findByTestId('inventory-list')
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error fetching locations:', expect.any(Error))
    )
  })

  it('renders a household selector for multiple households and switches', async () => {
    mockListHouseholds.mockResolvedValue([household(), household({ id: 2, name: 'Cabin' })])
    render(<Inventory />)
    const select = (await screen.findByLabelText('Select Household')) as HTMLSelectElement
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: '2' } })
    await waitFor(() => expect(mockListInventory).toHaveBeenCalledWith(2, expect.anything()))
  })

  it('shows an inventory load error', async () => {
    mockListInventory.mockRejectedValue({ response: { data: { error: 'inv boom' } } })
    render(<Inventory />)
    expect(await screen.findByText('inv boom')).toBeInTheDocument()
  })

  it('shows the empty state, and a search-specific empty message', async () => {
    mockListInventory.mockResolvedValue(listResponse({ items: [], total: 0 }))
    render(<Inventory />)
    expect(await screen.findByText('No items in your inventory yet')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'xyz' } })
    expect(await screen.findByText('No items found matching your search')).toBeInTheDocument()
  })

  it('handles search, sort toggling, and pagination', async () => {
    render(<Inventory />)
    await screen.findByTestId('inventory-list')

    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'milk' } })
    await waitFor(() =>
      expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ search: 'milk' }))
    )

    fireEvent.click(screen.getByRole('button', { name: 'sort-same' })) // toggles order asc
    await waitFor(() =>
      expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ sort_order: 'asc' }))
    )
    fireEvent.click(screen.getByRole('button', { name: 'sort-other' })) // new field, desc
    await waitFor(() =>
      expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ sort_by: 'name', sort_order: 'desc' }))
    )

    fireEvent.click(screen.getByRole('button', { name: 'page-2' }))
    await waitFor(() => expect(mockListInventory).toHaveBeenCalledWith(1, expect.objectContaining({ page: 2 })))
    expect(window.scrollTo).toHaveBeenCalled()
  })

  it('opens and closes the edit modal, refreshing on success', async () => {
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-edit' }))
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'edit-success' }))
    await waitFor(() => expect(mockListInventory).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'edit-close' }))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })

  it('logs an error if refresh-after-edit fails', async () => {
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-edit' }))
    mockListInventory.mockRejectedValueOnce(new Error('refresh fail'))
    fireEvent.click(screen.getByRole('button', { name: 'edit-success' }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error refreshing inventory:', expect.any(Error))
    )
  })

  it('views an item, then routes detail actions to edit and delete', async () => {
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-view' }))
    expect(screen.getByTestId('detail-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'detail-edit' }))
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('detail-modal')).not.toBeInTheDocument()

    // Re-open detail and route to delete.
    fireEvent.click(screen.getByRole('button', { name: 'edit-close' }))
    fireEvent.click(screen.getByRole('button', { name: 'list-view' }))
    fireEvent.click(screen.getByRole('button', { name: 'detail-delete' }))
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
  })

  it('closes the detail modal', async () => {
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-view' }))
    fireEvent.click(screen.getByRole('button', { name: 'detail-close' }))
    expect(screen.queryByTestId('detail-modal')).not.toBeInTheDocument()
  })

  it('confirms a delete and refreshes, and cancels the dialog', async () => {
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-delete' }))
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'list-delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDeleteItem).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Delete Item')).not.toBeInTheDocument())
  })

  it('shows an error when the delete fails', async () => {
    mockDeleteItem.mockRejectedValue({ response: { data: { error: 'del boom' } } })
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'list-delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('del boom')).toBeInTheDocument()
  })

  it('navigates via the header buttons', async () => {
    render(<Inventory />)
    await screen.findByTestId('inventory-list')
    fireEvent.click(screen.getByRole('button', { name: 'Recipes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    expect(mockNavigate).toHaveBeenCalledWith('/settings')
    expect(mockNavigate).toHaveBeenCalledWith('/add-item')
  })

  it('logs out with and without a refresh token, and on failure', async () => {
    const { unmount } = render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(mockLogout).toHaveBeenCalledWith('ref-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
    unmount()

    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 1 } as never, refreshToken: null })
    const second = render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(mockLogout).not.toHaveBeenCalled()
    second.unmount()

    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 1 } as never, refreshToken: 'ref-2' })
    mockListHouseholds.mockResolvedValue([household()])
    mockListInventory.mockResolvedValue(listResponse())
    mockLogout.mockRejectedValue(new Error('logout fail'))
    render(<Inventory />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Error logging out:', expect.any(Error))
    )
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('uses the light logo in dark mode', async () => {
    useThemeStore.setState({ resolvedTheme: 'dark' })
    render(<Inventory />)
    expect((await screen.findByAltText('Pantrie')) as HTMLImageElement).toHaveAttribute(
      'src',
      '/pantrie-logo-light.png'
    )
  })
})
