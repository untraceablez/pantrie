import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InventoryList from './InventoryList'
import { type InventoryItem } from '@/services/inventory'

// Stub the card so this suite stays focused on list/sort/pagination logic.
vi.mock('./InventoryItemCard', () => ({
  default: ({ item }: { item: InventoryItem }) => <div data-testid="card">{item.name}</div>,
}))

const item = (over: Partial<InventoryItem> = {}): InventoryItem =>
  ({ id: 1, name: 'Milk', ...over }) as InventoryItem

const baseProps = {
  items: [item({ id: 1, name: 'Milk' }), item({ id: 2, name: 'Eggs' })],
  total: 2,
  page: 1,
  pageSize: 12,
  totalPages: 1,
  onPageChange: vi.fn(),
  onSortChange: vi.fn(),
  sortBy: 'name',
  sortOrder: 'asc' as const,
}

describe('InventoryList', () => {
  it('renders the showing-range summary and a card per item', () => {
    render(<InventoryList {...baseProps} />)
    expect(screen.getByText('Showing 1-2 of 2 items')).toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })

  it('computes the range across pages', () => {
    render(<InventoryList {...baseProps} total={30} page={2} pageSize={12} totalPages={3} />)
    expect(screen.getByText('Showing 13-24 of 30 items')).toBeInTheDocument()
  })

  it('marks the active sort field with an ascending arrow', () => {
    render(<InventoryList {...baseProps} sortBy="name" sortOrder="asc" />)
    expect(screen.getByRole('button', { name: /Name/ })).toHaveTextContent('↑')
  })

  it('marks the active sort field with a descending arrow', () => {
    render(<InventoryList {...baseProps} sortBy="name" sortOrder="desc" />)
    expect(screen.getByRole('button', { name: /Name/ })).toHaveTextContent('↓')
  })

  it('fires onSortChange when a sort button is clicked', () => {
    const onSortChange = vi.fn()
    render(<InventoryList {...baseProps} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expiration' }))
    expect(onSortChange).toHaveBeenCalledWith('expiration_date')
  })

  it('hides pagination when there is a single page', () => {
    render(<InventoryList {...baseProps} totalPages={1} />)
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('disables Previous on the first page', () => {
    render(<InventoryList {...baseProps} totalPages={3} page={1} />)
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Next on the last page', () => {
    render(<InventoryList {...baseProps} totalPages={3} page={3} />)
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('navigates via Previous and Next', () => {
    const onPageChange = vi.fn()
    render(<InventoryList {...baseProps} totalPages={3} page={2} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('renders numbered pages, ellipses, and the active page; navigates by number', () => {
    const onPageChange = vi.fn()
    render(
      <InventoryList {...baseProps} total={120} totalPages={10} page={5} pageSize={12} onPageChange={onPageChange} />
    )
    // First, last, and the window around current (4,5,6) are shown; far pages collapse to "..."
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '8' })).not.toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: '6' }))
    expect(onPageChange).toHaveBeenCalledWith(6)
  })
})
