import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PageHeader from './PageHeader'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const renderHeader = (onLogout = vi.fn()) =>
  render(
    <MemoryRouter>
      <PageHeader
        title="Dashboard"
        subtitle="What needs your attention today"
        siblingLabel="Inventory"
        siblingTo="/inventory"
        onLogout={onLogout}
      />
    </MemoryRouter>
  )

describe('PageHeader', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the title and subtitle', () => {
    renderHeader()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('What needs your attention today')).toBeInTheDocument()
  })

  it('navigates to the sibling page', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    expect(mockNavigate).toHaveBeenCalledWith('/inventory')
  })

  it.each([
    ['Recipes', '/recipes'],
    ['Settings', '/settings'],
    ['Add Item', '/add-item'],
  ])('navigates to %s', async (label, to) => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: label }))
    expect(mockNavigate).toHaveBeenCalledWith(to)
  })

  it('calls onLogout rather than navigating', async () => {
    const onLogout = vi.fn()
    renderHeader(onLogout)
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
