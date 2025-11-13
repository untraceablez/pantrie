import React, { useState, useEffect } from 'react'
import { getCurrentUser, updateCurrentUser, changePassword, uploadAvatar, User } from '../../services/user'
import { useThemeStore, type ThemeMode } from '../../store/themeStore'

const UserSettings: React.FC = () => {
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Profile form state
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await getCurrentUser()
      setUser(userData)
      setUsername(userData.username)
      setEmail(userData.email)
      setFirstName(userData.first_name || '')
      setLastName(userData.last_name || '')
      setAvatarPreview(userData.avatar_url)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const updateData: any = {}
      if (username !== user?.username) updateData.username = username
      if (email !== user?.email) updateData.email = email
      if (firstName !== user?.first_name) updateData.first_name = firstName || null
      if (lastName !== user?.last_name) updateData.last_name = lastName || null

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save')
        return
      }

      const updatedUser = await updateCurrentUser(updateData)
      setUser(updatedUser)
      setSuccess('Profile updated successfully')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Avatar file size must be less than 10MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Avatar must be an image file')
      return
    }

    setAvatarFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return

    try {
      setUploadingAvatar(true)
      setError(null)
      setSuccess(null)

      await uploadAvatar(avatarFile)

      // Reload user to get updated avatar URL
      await loadUser()

      setAvatarFile(null)
      setSuccess('Avatar uploaded successfully')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate new password
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    try {
      setChangingPassword(true)
      setError(null)
      setSuccess(null)

      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password changed successfully')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading user profile...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold mb-6">Account Settings</h2>
        <div className="p-8 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-700 font-medium mb-2">Failed to load user profile</div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            onClick={loadUser}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Account Settings</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Avatar Section */}
      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Profile Picture</h3>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-500">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-grow">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="mb-2 block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <p className="text-sm text-gray-500 mb-2">
              Maximum file size: 10MB. Supported formats: JPEG, PNG, GIF, WebP
            </p>
            {avatarFile && (
              <button
                onClick={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Profile Information</h3>
        <form onSubmit={handleProfileUpdate}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Change Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={8}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Must be at least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {changingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Theme Section */}
      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setThemeMode('system')}
                className={`px-4 py-3 rounded-md border-2 transition-colors ${
                  themeMode === 'system'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex flex-col items-center">
                  <svg
                    className="w-6 h-6 mb-1"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span className="text-sm font-medium">System</span>
                </div>
              </button>

              <button
                onClick={() => setThemeMode('light')}
                className={`px-4 py-3 rounded-md border-2 transition-colors ${
                  themeMode === 'light'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex flex-col items-center">
                  <svg
                    className="w-6 h-6 mb-1"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                  <span className="text-sm font-medium">Light</span>
                </div>
              </button>

              <button
                onClick={() => setThemeMode('dark')}
                className={`px-4 py-3 rounded-md border-2 transition-colors ${
                  themeMode === 'dark'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex flex-col items-center">
                  <svg
                    className="w-6 h-6 mb-1"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                  </svg>
                  <span className="text-sm font-medium">Dark</span>
                </div>
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {themeMode === 'system'
                ? 'Theme will automatically match your system preferences'
                : `Theme is set to ${themeMode} mode`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSettings
