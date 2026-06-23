import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserManagement from './UserManagement'
import { siteAdminService } from '@/services/siteAdmin'

vi.mock('@/services/siteAdmin', () => ({
  siteAdminService: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

const mockList = vi.mocked(siteAdminService.listUsers)
const mockCreate = vi.mocked(siteAdminService.createUser)
const mockUpdate = vi.mocked(siteAdminService.updateUser)
const mockDelete = vi.mocked(siteAdminService.deleteUser)

const user = (over = {}) => ({
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  is_active: true,
  is_verified: true,
  site_role: 'user',
  created_at: '',
  household_count: 2,
  ...over,
})

describe('UserManagement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads and lists users', async () => {
    mockList.mockResolvedValue([user()])
    render(<UserManagement />)
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // household count
  })

  it('shows a load error', async () => {
    mockList.mockRejectedValue(new Error('network'))
    render(<UserManagement />)
    expect(await screen.findByText('Failed to load users')).toBeInTheDocument()
  })

  it('creates a user', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue({} as never)
    render(<UserManagement />)
    await screen.findByText('User Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'site_administrator' } })
    fireEvent.click(screen.getByLabelText('Mark as verified'))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'a@b.c',
          username: 'newuser',
          password: 'pw',
          site_role: 'site_administrator',
          is_verified: true,
        })
      )
    )
    expect(await screen.findByText('User created successfully')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('surfaces a create error (detail + fallback)', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValueOnce({ response: { data: { detail: 'email taken' } } })
    render(<UserManagement />)
    await screen.findByText('User Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'u' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('email taken')).toBeInTheDocument()

    mockCreate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Failed to create user')).toBeInTheDocument()
  })

  it('edits a user', async () => {
    mockList.mockResolvedValue([user()])
    mockUpdate.mockResolvedValue({} as never)
    render(<UserManagement />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit User')).toBeInTheDocument()
    // Exercise every edit-modal field handler.
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@b.c' } })
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newname' } })
    fireEvent.change(screen.getByPlaceholderText(/New Password/i), { target: { value: 'pw2' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'site_administrator' } })
    fireEvent.click(screen.getByLabelText('Active'))
    fireEvent.click(screen.getByLabelText('Verified'))
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ email: 'new@b.c', username: 'newname', password: 'pw2', site_role: 'site_administrator' })
      )
    )
    expect(await screen.findByText('User updated successfully')).toBeInTheDocument()
  })

  it('surfaces an edit error', async () => {
    mockList.mockResolvedValue([user()])
    mockUpdate.mockRejectedValue({ response: { data: { detail: 'edit fail' } } })
    render(<UserManagement />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByText('edit fail')).toBeInTheDocument()
  })

  it('deletes a user after confirmation, and not when cancelled', async () => {
    mockList.mockResolvedValue([user()])
    mockDelete.mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<UserManagement />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(await screen.findByText('User deleted successfully')).toBeInTheDocument()
  })

  it('surfaces a delete error', async () => {
    mockList.mockResolvedValue([user()])
    mockDelete.mockRejectedValue(new Error('network'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<UserManagement />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Failed to delete user')).toBeInTheDocument()
  })

  it('closes the create modal via Cancel', async () => {
    mockList.mockResolvedValue([])
    render(<UserManagement />)
    await screen.findByText('User Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))
    expect(screen.getByText('Create User', { selector: 'h3' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Create User', { selector: 'h3' })).not.toBeInTheDocument()
  })
})
