import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HouseholdMembers from './HouseholdMembers'
import * as svc from '@/services/householdMembers'

vi.mock('@/services/householdMembers', () => ({
  listHouseholdMembers: vi.fn(),
  addHouseholdMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))

const mockList = vi.mocked(svc.listHouseholdMembers)
const mockAdd = vi.mocked(svc.addHouseholdMember)
const mockUpdate = vi.mocked(svc.updateMemberRole)
const mockRemove = vi.mocked(svc.removeMember)

const member = (over: Partial<svc.HouseholdMember> = {}): svc.HouseholdMember => ({
  id: 1,
  user_id: 1,
  username: 'alice',
  email: 'alice@example.com',
  role: 'viewer',
  joined_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('HouseholdMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('blocks non-admins', () => {
    render(<HouseholdMembers householdId={1} isAdmin={false} />)
    expect(screen.getByText('You need admin role to manage household members.')).toBeInTheDocument()
  })

  it('loads and lists members', async () => {
    mockList.mockResolvedValue([member()])
    render(<HouseholdMembers householdId={1} isAdmin />)
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    mockList.mockResolvedValue([])
    render(<HouseholdMembers householdId={1} isAdmin />)
    expect(await screen.findByText('No members found')).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    mockList.mockRejectedValue({ response: { data: { error: 'load boom' } } })
    render(<HouseholdMembers householdId={1} isAdmin />)
    expect(await screen.findByText('load boom')).toBeInTheDocument()
  })

  it('toggles and submits the add-member form', async () => {
    mockList.mockResolvedValue([])
    mockAdd.mockResolvedValue(member({ id: 2, email: 'bob@example.com', username: 'bob' }))
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('No members found')

    fireEvent.click(screen.getByRole('button', { name: 'Add Member' })) // open form
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'bob@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'editor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' })) // submit

    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith(1, { email: 'bob@example.com', role: 'editor' })
    )
    expect(
      await screen.findByText('Successfully added bob@example.com to the household')
    ).toBeInTheDocument()
  })

  it('hides the add form when toggled twice', async () => {
    mockList.mockResolvedValue([])
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('No members found')

    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Email Address')).not.toBeInTheDocument()
  })

  it('surfaces an add error', async () => {
    mockList.mockResolvedValue([])
    mockAdd.mockRejectedValue({ response: { data: { error: 'dup member' } } })
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('No members found')

    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'x@y.z' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }))
    expect(await screen.findByText('dup member')).toBeInTheDocument()
  })

  it('updates a member role', async () => {
    mockList.mockResolvedValue([member()])
    mockUpdate.mockResolvedValue(member({ role: 'admin' }))
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('alice')

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'admin' } })
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, 1, { role: 'admin' }))
    expect(await screen.findByText('Member role updated successfully')).toBeInTheDocument()
  })

  it('surfaces a role-update error (with fallback)', async () => {
    mockList.mockResolvedValue([member()])
    mockUpdate.mockRejectedValue(new Error('network'))
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('alice')

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'editor' } })
    expect(await screen.findByText('Failed to update role')).toBeInTheDocument()
  })

  it('removes a member after confirmation, and not when cancelled', async () => {
    mockList.mockResolvedValue([member()])
    mockRemove.mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(mockRemove).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(1, 1))
    expect(
      await screen.findByText('Successfully removed alice@example.com from the household')
    ).toBeInTheDocument()
  })

  it('surfaces a remove error', async () => {
    mockList.mockResolvedValue([member()])
    mockRemove.mockRejectedValue({ response: { data: { error: 'cannot remove' } } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<HouseholdMembers householdId={1} isAdmin />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('cannot remove')).toBeInTheDocument()
  })
})
