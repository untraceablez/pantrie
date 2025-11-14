import { useState, useEffect } from 'react'
import { siteAdminService, UserListItem, UserCreateData, UserUpdateData } from '@/services/siteAdmin'

export default function UserManagement() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)

  const [createForm, setCreateForm] = useState<UserCreateData>({
    email: '',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    is_verified: false,
    site_role: 'user',
  })

  const [editForm, setEditForm] = useState<UserUpdateData>({})

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await siteAdminService.listUsers()
      setUsers(data)
    } catch (err: any) {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      await siteAdminService.createUser(createForm)
      setSuccess('User created successfully')
      setShowCreateModal(false)
      setCreateForm({
        email: '',
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        is_verified: false,
        site_role: 'user',
      })
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setError('')
    setSuccess('')

    try {
      await siteAdminService.updateUser(selectedUser.id, editForm)
      setSuccess('User updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      setEditForm({})
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user')
    }
  }

  const handleDelete = async (user: UserListItem) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return

    try {
      await siteAdminService.deleteUser(user.id)
      setSuccess('User deleted successfully')
      await loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const openEditModal = (user: UserListItem) => {
    setSelectedUser(user)
    setEditForm({
      email: user.email,
      username: user.username,
      is_active: user.is_active,
      is_verified: user.is_verified,
      site_role: user.site_role,
    })
    setShowEditModal(true)
  }

  if (loading) {
    return <div className="p-6">Loading users...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage all users in the system
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Create User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Households</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.site_role === 'site_administrator' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                    {user.site_role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex gap-2">
                    {user.is_active && <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">Active</span>}
                    {user.is_verified && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">Verified</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.household_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-primary hover:text-primary/80"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create User</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <input
                type="text"
                placeholder="Username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              <select
                value={createForm.site_role}
                onChange={(e) => setCreateForm({ ...createForm, site_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="user">User</option>
                <option value="site_administrator">Site Administrator</option>
              </select>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={createForm.is_verified}
                  onChange={(e) => setCreateForm({ ...createForm, is_verified: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">Mark as verified</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit User</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                placeholder="Username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="password"
                placeholder="New Password (leave blank to keep current)"
                value={editForm.password || ''}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <select
                value={editForm.site_role}
                onChange={(e) => setEditForm({ ...editForm, site_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="user">User</option>
                <option value="site_administrator">Site Administrator</option>
              </select>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editForm.is_active ?? true}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">Active</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editForm.is_verified ?? false}
                  onChange={(e) => setEditForm({ ...editForm, is_verified: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">Verified</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
