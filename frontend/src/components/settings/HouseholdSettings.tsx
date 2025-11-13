import { useState, useEffect } from 'react'
import { listHouseholds, updateHousehold, HouseholdWithRole } from '@/services/household'
import { useAuthStore } from '@/store/authStore'
import LocationManager from './LocationManager'
import AllergenManager from './AllergenManager'

export default function HouseholdSettings() {
  const { user } = useAuthStore()
  const [households, setHouseholds] = useState<HouseholdWithRole[]>([])
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state for selected household
  const [householdName, setHouseholdName] = useState('')
  const [householdDescription, setHouseholdDescription] = useState('')

  // Fetch households on mount
  useEffect(() => {
    const fetchHouseholds = async () => {
      if (!user) return

      try {
        setLoading(true)
        const userHouseholds = await listHouseholds()
        setHouseholds(userHouseholds)

        if (userHouseholds.length > 0) {
          setSelectedHouseholdId(userHouseholds[0].id)
        }
      } catch (err) {
        console.error('Error fetching households:', err)
        setError('Failed to load households')
      } finally {
        setLoading(false)
      }
    }

    fetchHouseholds()
  }, [user])

  // Update form when selected household changes
  useEffect(() => {
    const selectedHousehold = households.find(h => h.id === selectedHouseholdId)
    if (selectedHousehold) {
      setHouseholdName(selectedHousehold.name)
      setHouseholdDescription(selectedHousehold.description || '')
    }
  }, [selectedHouseholdId, households])

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHouseholdId) return

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await updateHousehold(selectedHouseholdId, {
        name: householdName.trim(),
        description: householdDescription.trim() || null,
      })

      // Refresh households list
      const updatedHouseholds = await listHouseholds()
      setHouseholds(updatedHouseholds)
      setSuccess('Household settings saved successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error updating household:', err)
      setError(err.response?.data?.error || 'Failed to update household')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <p className="text-gray-500 dark:text-gray-400">Loading households...</p>
      </div>
    )
  }

  if (households.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <p className="text-gray-500 dark:text-gray-400">No households found. Create one from the Add Item page.</p>
      </div>
    )
  }

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId)
  const canEdit = selectedHousehold?.user_role === 'admin' || selectedHousehold?.user_role === 'editor'

  return (
    <div className="space-y-6">
      {/* Household Selector */}
      {households.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <label htmlFor="household-select" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Select Household
          </label>
          <select
            id="household-select"
            value={selectedHouseholdId || ''}
            onChange={(e) => setSelectedHouseholdId(Number(e.target.value))}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          >
            {households.map((household) => (
              <option key={household.id} value={household.id}>
                {household.name} ({household.user_role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Household Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Household Details</h2>

        {!canEdit && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You need editor or admin role to modify household settings.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        <form onSubmit={handleSaveHousehold} className="space-y-4">
          <div>
            <label htmlFor="household-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Household Name *
            </label>
            <input
              type="text"
              id="household-name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              required
              disabled={!canEdit || saving}
            />
          </div>

          <div>
            <label htmlFor="household-description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Description
            </label>
            <textarea
              id="household-description"
              value={householdDescription}
              onChange={(e) => setHouseholdDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:placeholder-gray-400"
              disabled={!canEdit || saving}
              placeholder="Optional description for your household"
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Allergen Manager */}
      {selectedHouseholdId && (
        <AllergenManager householdId={selectedHouseholdId} canEdit={canEdit} />
      )}

      {/* Location Manager */}
      {selectedHouseholdId && (
        <LocationManager householdId={selectedHouseholdId} canEdit={canEdit} />
      )}
    </div>
  )
}
