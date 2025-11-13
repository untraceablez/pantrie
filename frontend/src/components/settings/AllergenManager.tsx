import { useState, useEffect } from 'react'
import { listHouseholdAllergens, createAllergen, deleteAllergen, type Allergen } from '@/services/allergen'

interface AllergenManagerProps {
  householdId: number
  canEdit: boolean
}

export default function AllergenManager({ householdId, canEdit }: AllergenManagerProps) {
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [newAllergenName, setNewAllergenName] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchAllergens = async () => {
    try {
      setLoading(true)
      const householdAllergens = await listHouseholdAllergens(householdId)
      setAllergens(householdAllergens)
      setError('')
    } catch (err) {
      console.error('Error fetching allergens:', err)
      setError('Failed to load allergens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllergens()
  }, [householdId])

  const handleDelete = async (allergenId: number) => {
    if (!confirm('Are you sure you want to delete this allergen?')) {
      return
    }

    try {
      setDeletingId(allergenId)
      await deleteAllergen(allergenId)
      await fetchAllergens()
    } catch (err: any) {
      console.error('Error deleting allergen:', err)
      setError(err.response?.data?.error || 'Failed to delete allergen')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddAllergen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAllergenName.trim()) return

    try {
      setAdding(true)
      setError('')
      await createAllergen(householdId, { name: newAllergenName.trim() })
      setNewAllergenName('')
      await fetchAllergens()
    } catch (err: any) {
      console.error('Error adding allergen:', err)
      setError(err.response?.data?.error || 'Failed to add allergen')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Allergens</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Track household allergens and get warnings when they appear in product ingredients
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Add Allergen Form */}
      {canEdit && (
        <form onSubmit={handleAddAllergen} className="mb-6">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newAllergenName}
              onChange={(e) => setNewAllergenName(e.target.value)}
              placeholder="Enter allergen name (e.g., peanuts, dairy, soy)"
              className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:placeholder-gray-400"
              disabled={adding}
            />
            <button
              type="submit"
              disabled={adding || !newAllergenName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Allergen List */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading allergens...</p>
      ) : allergens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No custom allergens yet</p>
          {canEdit && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add allergens above to get warnings when they appear in product ingredients
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {allergens.map((allergen) => (
            <div
              key={allergen.id}
              className="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:shadow-sm transition-shadow bg-white dark:bg-gray-700"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
                <span className="text-gray-900 dark:text-white font-medium capitalize">
                  {allergen.name}
                </span>
              </div>

              {canEdit && (
                <button
                  onClick={() => handleDelete(allergen.id)}
                  disabled={deletingId === allergen.id}
                  className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 disabled:opacity-50"
                  title="Delete allergen"
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
