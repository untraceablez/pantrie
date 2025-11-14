import { useState, useEffect } from 'react'
import {
  listHouseholdMembers,
  addHouseholdMember,
  updateMemberRole,
  removeMember,
  type HouseholdMember,
} from '@/services/householdMembers'

interface HouseholdMembersProps {
  householdId: number
  isAdmin: boolean
}

export default function HouseholdMembers({ householdId, isAdmin }: HouseholdMembersProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  // Add member form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'editor' | 'viewer'>('viewer')
  const [addingMember, setAddingMember] = useState(false)

  // Fetch members when household changes
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await listHouseholdMembers(householdId)
        setMembers(data)
      } catch (err: any) {
        console.error('Error fetching members:', err)
        setError(err.response?.data?.error || 'Failed to load members')
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [householdId])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setAddingMember(true)
      setError('')
      setSuccess('')

      const newMember = await addHouseholdMember(householdId, {
        email: newMemberEmail,
        role: newMemberRole,
      })

      setMembers([...members, newMember])
      setSuccess(`Successfully added ${newMemberEmail} to the household`)
      setNewMemberEmail('')
      setNewMemberRole('viewer')
      setShowAddForm(false)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error adding member:', err)
      setError(err.response?.data?.error || 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  const handleUpdateRole = async (membershipId: number, newRole: 'admin' | 'editor' | 'viewer') => {
    try {
      setError('')
      setSuccess('')

      const updatedMember = await updateMemberRole(householdId, membershipId, {
        role: newRole,
      })

      setMembers(members.map(m => m.id === membershipId ? updatedMember : m))
      setSuccess('Member role updated successfully')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error updating role:', err)
      setError(err.response?.data?.error || 'Failed to update role')
    }
  }

  const handleRemoveMember = async (membershipId: number, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this household?`)) return

    try {
      setError('')
      setSuccess('')

      await removeMember(householdId, membershipId)
      setMembers(members.filter(m => m.id !== membershipId))
      setSuccess(`Successfully removed ${memberEmail} from the household`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error removing member:', err)
      setError(err.response?.data?.error || 'Failed to remove member')
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Household Members
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          You need admin role to manage household members.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Household Members
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
        >
          {showAddForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-md text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Add member form */}
      {showAddForm && (
        <form onSubmit={handleAddMember} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="member-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="member-email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                required
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label htmlFor="member-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                id="member-role"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={addingMember}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm disabled:opacity-50"
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading members...</p>
      ) : members.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No members found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.username}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as 'admin' | 'editor' | 'viewer')}
                      className="block rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:border-primary focus:ring-primary"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleRemoveMember(member.id, member.email)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role descriptions */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Role Descriptions</h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-medium">Admin:</span> Full access - can manage members, edit household, and manage inventory</li>
          <li><span className="font-medium">Editor:</span> Can add, edit, and delete inventory items</li>
          <li><span className="font-medium">Viewer:</span> Can only view inventory items</li>
        </ul>
      </div>
    </div>
  )
}
