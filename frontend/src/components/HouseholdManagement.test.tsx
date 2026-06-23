import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HouseholdManagement from './HouseholdManagement'
import { siteAdminService } from '@/services/siteAdmin'

vi.mock('@/services/siteAdmin', () => ({
  siteAdminService: {
    listHouseholds: vi.fn(),
    listUsers: vi.fn(),
    createHousehold: vi.fn(),
    updateHousehold: vi.fn(),
    deleteHousehold: vi.fn(),
  },
}))

const mockListHH = vi.mocked(siteAdminService.listHouseholds)
const mockListUsers = vi.mocked(siteAdminService.listUsers)
const mockCreate = vi.mocked(siteAdminService.createHousehold)
const mockUpdate = vi.mocked(siteAdminService.updateHousehold)
const mockDelete = vi.mocked(siteAdminService.deleteHousehold)

const hh = (over = {}) => ({ id: 1, name: 'Home', member_count: 3, created_at: '2026-01-01T00:00:00Z', ...over })
const usr = (over = {}) => ({
  id: 7, username: 'owner', email: 'owner@x.y', is_active: true, is_verified: true,
  site_role: 'user', created_at: '', household_count: 0, ...over,
})

describe('HouseholdManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListUsers.mockResolvedValue([usr()])
  })

  it('loads and lists households', async () => {
    mockListHH.mockResolvedValue([hh()])
    render(<HouseholdManagement />)
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // member count
  })

  it('shows a load error', async () => {
    mockListHH.mockRejectedValue(new Error('network'))
    render(<HouseholdManagement />)
    expect(await screen.findByText('Failed to load data')).toBeInTheDocument()
  })

  it('creates a household with a selected admin user', async () => {
    mockListHH.mockResolvedValue([])
    mockCreate.mockResolvedValue({} as never)
    render(<HouseholdManagement />)
    await screen.findByText('Household Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create Household' }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Home' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ name: 'New Home', admin_user_id: 7 })
    )
    expect(await screen.findByText('Household created successfully')).toBeInTheDocument()
    expect(mockListHH).toHaveBeenCalledTimes(2)
  })

  it('surfaces a create error (detail + fallback)', async () => {
    mockListHH.mockResolvedValue([])
    mockCreate.mockRejectedValueOnce({ response: { data: { detail: 'bad admin' } } })
    render(<HouseholdManagement />)
    await screen.findByText('Household Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create Household' }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('bad admin')).toBeInTheDocument()

    mockCreate.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Failed to create household')).toBeInTheDocument()
  })

  it('edits a household name', async () => {
    mockListHH.mockResolvedValue([hh()])
    mockUpdate.mockResolvedValue({} as never)
    render(<HouseholdManagement />)
    await screen.findByText('Home')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Household')).toBeInTheDocument()
    const nameInput = screen.getByPlaceholderText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('Home') // prefilled
    fireEvent.change(nameInput, { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Renamed' }))
    expect(await screen.findByText('Household updated successfully')).toBeInTheDocument()
  })

  it('surfaces an edit error', async () => {
    mockListHH.mockResolvedValue([hh()])
    mockUpdate.mockRejectedValue({ response: { data: { detail: 'edit fail' } } })
    render(<HouseholdManagement />)
    await screen.findByText('Home')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByText('edit fail')).toBeInTheDocument()
  })

  it('deletes a household after confirmation, and not when cancelled', async () => {
    mockListHH.mockResolvedValue([hh()])
    mockDelete.mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<HouseholdManagement />)
    await screen.findByText('Home')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockDelete).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Household deleted successfully')).toBeInTheDocument()
  })

  it('surfaces a delete error', async () => {
    mockListHH.mockResolvedValue([hh()])
    mockDelete.mockRejectedValue(new Error('network'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<HouseholdManagement />)
    await screen.findByText('Home')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Failed to delete household')).toBeInTheDocument()
  })

  it('closes the create modal via Cancel', async () => {
    mockListHH.mockResolvedValue([])
    render(<HouseholdManagement />)
    await screen.findByText('Household Management')

    fireEvent.click(screen.getByRole('button', { name: 'Create Household' }))
    expect(screen.getByText('Create Household', { selector: 'h3' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Create Household', { selector: 'h3' })).not.toBeInTheDocument()
  })
})
