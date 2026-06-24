import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AddItem from './AddItem'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

// Stub the form, exposing its success/cancel callbacks as buttons.
vi.mock('@/components/inventory/AddItemForm', () => ({
  default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div>
      <button onClick={onSuccess}>form-success</button>
      <button onClick={onCancel}>form-cancel</button>
    </div>
  ),
}))

describe('AddItem page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the header and form', () => {
    render(<AddItem />)
    expect(screen.getByRole('heading', { name: 'Add New Item' })).toBeInTheDocument()
    expect(screen.getByText('form-success')).toBeInTheDocument()
  })

  it('navigates to the dashboard on the back button', () => {
    render(<AddItem />)
    fireEvent.click(screen.getByRole('button', { name: /Back to Dashboard/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('navigates to the dashboard on form success and cancel', () => {
    render(<AddItem />)
    fireEvent.click(screen.getByRole('button', { name: 'form-success' }))
    fireEvent.click(screen.getByRole('button', { name: 'form-cancel' }))
    expect(mockNavigate).toHaveBeenCalledTimes(2)
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/dashboard')
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/dashboard')
  })
})
