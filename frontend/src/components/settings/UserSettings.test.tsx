import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserSettings from './UserSettings'
import * as userSvc from '../../services/user'
import { useThemeStore } from '../../store/themeStore'

vi.mock('../../services/user', () => ({
  getCurrentUser: vi.fn(),
  updateCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  uploadAvatar: vi.fn(),
}))

const mockGet = vi.mocked(userSvc.getCurrentUser)
const mockUpdate = vi.mocked(userSvc.updateCurrentUser)
const mockChangePw = vi.mocked(userSvc.changePassword)
const mockUpload = vi.mocked(userSvc.uploadAvatar)

const user = (over = {}) => ({
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  first_name: 'Al',
  last_name: 'Ice',
  avatar_url: null,
  is_active: true,
  is_verified: true,
  oauth_provider: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const pwInputs = (container: HTMLElement) =>
  container.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>

describe('UserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useThemeStore.setState({ mode: 'system', resolvedTheme: 'light' })
  })

  it('loads and prefills the profile', async () => {
    mockGet.mockResolvedValue(user())
    render(<UserSettings />)
    expect(await screen.findByDisplayValue('alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('shows the failure state with a working Retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    render(<UserSettings />)
    expect(await screen.findByText('Failed to load user profile')).toBeInTheDocument()

    mockGet.mockResolvedValueOnce(user())
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('alice')).toBeInTheDocument()
  })

  it('reports "no changes" when the profile is unchanged', async () => {
    mockGet.mockResolvedValue(user())
    render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))
    expect(await screen.findByText('No changes to save')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates a changed profile field', async () => {
    mockGet.mockResolvedValue(user())
    mockUpdate.mockResolvedValue(user({ username: 'alice2' }))
    render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    fireEvent.change(screen.getByDisplayValue('alice'), { target: { value: 'alice2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ username: 'alice2' }))
    expect(await screen.findByText('Profile updated successfully')).toBeInTheDocument()
  })

  it('surfaces a profile update error', async () => {
    mockGet.mockResolvedValue(user())
    mockUpdate.mockRejectedValue({ response: { data: { error: 'taken' } } })
    render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    fireEvent.change(screen.getByDisplayValue('alice@example.com'), { target: { value: 'x@y.z' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))
    expect(await screen.findByText('taken')).toBeInTheDocument()
  })

  it('rejects a non-image avatar and an oversized file', async () => {
    mockGet.mockResolvedValue(user())
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const txt = new File(['hi'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [txt] } })
    expect(await screen.findByText('Avatar must be an image file')).toBeInTheDocument()

    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [big] } })
    expect(await screen.findByText('Avatar file size must be less than 10MB')).toBeInTheDocument()
  })

  it('uploads a valid avatar', async () => {
    mockGet.mockResolvedValue(user())
    mockUpload.mockResolvedValue({ avatar_url: 'data:image/png;base64,xx' })
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const img = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [img] } })

    fireEvent.click(await screen.findByRole('button', { name: 'Upload Avatar' }))
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(img))
    expect(await screen.findByText('Avatar uploaded successfully')).toBeInTheDocument()
  })

  it('surfaces an avatar upload error', async () => {
    mockGet.mockResolvedValue(user())
    mockUpload.mockRejectedValue({ response: { data: { error: 'too big' } } })
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload Avatar' }))
    expect(await screen.findByText('too big')).toBeInTheDocument()
  })

  it('validates the password change (mismatch then too short)', async () => {
    mockGet.mockResolvedValue(user())
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    const [current, next, confirm] = Array.from(pwInputs(container))
    fireEvent.change(current, { target: { value: 'oldpassword' } })
    fireEvent.change(next, { target: { value: 'abcd1234' } })
    fireEvent.change(confirm, { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByText('New passwords do not match')).toBeInTheDocument()

    fireEvent.change(next, { target: { value: 'short' } })
    fireEvent.change(confirm, { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByText('New password must be at least 8 characters')).toBeInTheDocument()
    expect(mockChangePw).not.toHaveBeenCalled()
  })

  it('changes the password successfully', async () => {
    mockGet.mockResolvedValue(user())
    mockChangePw.mockResolvedValue()
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    const [current, next, confirm] = Array.from(pwInputs(container))
    fireEvent.change(current, { target: { value: 'oldpassword' } })
    fireEvent.change(next, { target: { value: 'newpassword1' } })
    fireEvent.change(confirm, { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))

    await waitFor(() =>
      expect(mockChangePw).toHaveBeenCalledWith({
        current_password: 'oldpassword',
        new_password: 'newpassword1',
      })
    )
    expect(await screen.findByText('Password changed successfully')).toBeInTheDocument()
  })

  it('surfaces a password change error', async () => {
    mockGet.mockResolvedValue(user())
    mockChangePw.mockRejectedValue({ response: { data: { error: 'wrong current' } } })
    const { container } = render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    const [current, next, confirm] = Array.from(pwInputs(container))
    fireEvent.change(current, { target: { value: 'oldpassword' } })
    fireEvent.change(next, { target: { value: 'newpassword1' } })
    fireEvent.change(confirm, { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByText('wrong current')).toBeInTheDocument()
  })

  it('switches the theme mode', async () => {
    mockGet.mockResolvedValue(user())
    render(<UserSettings />)
    await screen.findByDisplayValue('alice')

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(useThemeStore.getState().mode).toBe('light')
    expect(screen.getByText('Theme is set to light mode')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(screen.getByText('Theme is set to dark mode')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'System' }))
    expect(useThemeStore.getState().mode).toBe('system')
    expect(
      screen.getByText('Theme will automatically match your system preferences')
    ).toBeInTheDocument()
  })
})
