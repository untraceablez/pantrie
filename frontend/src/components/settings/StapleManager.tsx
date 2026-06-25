import { useState, useEffect } from 'react'
import { listHouseholdStaples, createStaple, deleteStaple, type Staple } from '@/services/staple'

interface StapleManagerProps {
  householdId: number
  canEdit: boolean
}

export default function StapleManager({ householdId, canEdit }: Readonly<StapleManagerProps>) {
  const [staples, setStaples] = useState<Staple[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [newStapleName, setNewStapleName] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchStaples = async () => {
    try {
      setLoading(true)
      const householdStaples = await listHouseholdStaples(householdId)
      setStaples(householdStaples)
      setError('')
    } catch (err) {
      console.error('Error fetching staples:', err)
      setError('Failed to load staples')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaples()
  }, [householdId])

  const handleDelete = async (stapleId: number) => {
    if (!confirm('Are you sure you want to remove this staple?')) {
      return
    }

    try {
      setDeletingId(stapleId)
      await deleteStaple(stapleId)
      await fetchStaples()
    } catch (err: any) {
      console.error('Error deleting staple:', err)
      setError(err.response?.data?.error || 'Failed to delete staple')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddStaple = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStapleName.trim()) return

    try {
      setAdding(true)
      setError('')
      await createStaple(householdId, { name: newStapleName.trim() })
      setNewStapleName('')
      await fetchStaples()
    } catch (err: any) {
      console.error('Error adding staple:', err)
      setError(err.response?.data?.error || 'Failed to add staple')
    } finally {
      setAdding(false)
    }
  }

  const renderStapleList = () => {
    if (loading) {
      return <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading staples...</p>
    }
    if (staples.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-2">No staples yet</p>
          {canEdit && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add staples above so common pantry items aren't flagged as missing for recipes
            </p>
          )}
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {staples.map((staple) => (
          <div
            key={staple.id}
            className="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:shadow-sm transition-shadow bg-white dark:bg-gray-700"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <span className="text-gray-900 dark:text-white font-medium capitalize">
                {staple.name}
              </span>
            </div>

            {canEdit && (
              <button
                onClick={() => handleDelete(staple.id)}
                disabled={deletingId === staple.id}
                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 disabled:opacity-50"
                title="Remove staple"
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
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pantry Staples</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Ingredients you always have on hand (like water). These are treated as in-stock for recipes
          and never appear in "missing" or shopping-list pushes.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Add Staple Form */}
      {canEdit && (
        <form onSubmit={handleAddStaple} className="mb-6">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newStapleName}
              onChange={(e) => setNewStapleName(e.target.value)}
              placeholder="Enter staple name (e.g., water, salt, olive oil)"
              className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm dark:placeholder-gray-400"
              disabled={adding}
            />
            <button
              type="submit"
              disabled={adding || !newStapleName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Staple List */}
      {renderStapleList()}
    </div>
  )
}
