import { useState, useEffect } from 'react'
import { listHouseholdLocations, deleteLocation, type Location } from '@/services/location'
import AddLocationModal from './AddLocationModal'
import EditLocationModal from './EditLocationModal'

interface LocationManagerProps {
  householdId: number
  canEdit: boolean
}

export default function LocationManager({ householdId, canEdit }: LocationManagerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchLocations = async () => {
    try {
      setLoading(true)
      const householdLocations = await listHouseholdLocations(householdId)
      setLocations(householdLocations)
      setError('')
    } catch (err) {
      console.error('Error fetching locations:', err)
      setError('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [householdId])

  const handleDelete = async (locationId: number) => {
    if (!confirm('Are you sure you want to delete this location? Items with this location will have it removed.')) {
      return
    }

    try {
      setDeletingId(locationId)
      await deleteLocation(locationId)
      await fetchLocations()
    } catch (err: any) {
      console.error('Error deleting location:', err)
      setError(err.response?.data?.error || 'Failed to delete location')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddSuccess = () => {
    setShowAddModal(false)
    fetchLocations()
  }

  const handleEditSuccess = () => {
    setEditingLocation(null)
    fetchLocations()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Storage Locations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage where items are stored in your household
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm"
            title="Add new location"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4v16m8-8H4"></path>
            </svg>
            <span>Add Location</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading locations...</p>
      ) : locations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No locations yet</p>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="text-primary hover:underline font-medium"
            >
              Add your first location
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((location) => (
            <div
              key={location.id}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {location.icon && (
                      <span className="text-2xl">{location.icon}</span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {location.name}
                    </h3>
                  </div>
                  {location.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {location.description}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setEditingLocation(location)}
                      className="text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary"
                      title="Edit location"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      disabled={deletingId === location.id}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 disabled:opacity-50"
                      title="Delete location"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddLocationModal
          householdId={householdId}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {editingLocation && (
        <EditLocationModal
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}
