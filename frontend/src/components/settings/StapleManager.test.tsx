import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StapleManager from './StapleManager'
import * as stapleService from '@/services/staple'

vi.mock('@/services/staple', () => ({
  listHouseholdStaples: vi.fn(),
  createStaple: vi.fn(),
  deleteStaple: vi.fn(),
}))

const mockList = vi.mocked(stapleService.listHouseholdStaples)
const mockCreate = vi.mocked(stapleService.createStaple)
const mockDelete = vi.mocked(stapleService.deleteStaple)

const staple = (over: Partial<stapleService.Staple> = {}): stapleService.Staple => ({
  id: 1,
  household_id: 1,
  name: 'water',
  created_at: '',
  updated_at: '',
  ...over,
})

describe('StapleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows loading then the staple list', async () => {
    mockList.mockResolvedValue([staple(), staple({ id: 2, name: 'salt' })])
    render(<StapleManager householdId={1} canEdit />)
    expect(screen.getByText('Loading staples...')).toBeInTheDocument()

    expect(await screen.findByText('water')).toBeInTheDocument()
    expect(screen.getByText('salt')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue([])
    render(<StapleManager householdId={1} canEdit />)
    expect(await screen.findByText('No staples yet')).toBeInTheDocument()
  })

  it('shows an error when the fetch fails', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    render(<StapleManager householdId={1} canEdit />)
    expect(await screen.findByText('Failed to load staples')).toBeInTheDocument()
  })

  it('adds a staple, clears the input, and refetches', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(staple())
    render(<StapleManager householdId={1} canEdit />)
    await screen.findByText('No staples yet')

    const input = screen.getByPlaceholderText(/enter staple name/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '  olive oil  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(1, { name: 'olive oil' }))
    await waitFor(() => expect(input.value).toBe(''))
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('disables Add for empty input and ignores an empty submit', async () => {
    mockList.mockResolvedValue([])
    render(<StapleManager householdId={1} canEdit />)
    await screen.findByText('No staples yet')

    const addButton = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement
    expect(addButton.disabled).toBe(true)

    const input = screen.getByPlaceholderText(/enter staple name/i)
    fireEvent.submit(input.closest('form')!)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('surfaces an add error, then falls back to a generic message', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValueOnce({ response: { data: { error: 'duplicate' } } })
    render(<StapleManager householdId={1} canEdit />)
    await screen.findByText('No staples yet')

    fireEvent.change(screen.getByPlaceholderText(/enter staple name/i), { target: { value: 'salt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('duplicate')).toBeInTheDocument()

    mockCreate.mockRejectedValueOnce(new Error('network'))
    fireEvent.change(screen.getByPlaceholderText(/enter staple name/i), { target: { value: 'salt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Failed to add staple')).toBeInTheDocument()
  })

  it('deletes a staple after confirmation, and not when cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockList.mockResolvedValue([staple()])
    mockDelete.mockResolvedValue()
    render(<StapleManager householdId={1} canEdit />)
    await screen.findByText('water')

    fireEvent.click(screen.getByTitle('Remove staple'))
    expect(mockDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByTitle('Remove staple'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('surfaces a delete error, then falls back to a generic message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockList.mockResolvedValue([staple()])
    mockDelete.mockRejectedValueOnce({ response: { data: { error: 'nope' } } })
    render(<StapleManager householdId={1} canEdit />)
    await screen.findByText('water')

    fireEvent.click(screen.getByTitle('Remove staple'))
    expect(await screen.findByText('nope')).toBeInTheDocument()

    mockDelete.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByTitle('Remove staple'))
    expect(await screen.findByText('Failed to delete staple')).toBeInTheDocument()
  })

  it('hides the add form and delete buttons when canEdit is false', async () => {
    mockList.mockResolvedValue([staple()])
    render(<StapleManager householdId={1} canEdit={false} />)
    await screen.findByText('water')
    expect(screen.queryByPlaceholderText(/enter staple name/i)).not.toBeInTheDocument()
    expect(screen.queryByTitle('Remove staple')).not.toBeInTheDocument()
  })
})
