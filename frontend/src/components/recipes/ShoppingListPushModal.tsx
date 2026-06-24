import { useEffect, useState } from 'react'
import {
  listShoppingLists,
  pushToShoppingList,
  type RecipeMakeability,
  type ShoppingList,
  type ShoppingListPushResult,
} from '@/services/mealie'

interface ShoppingListPushModalProps {
  householdId: number
  recipe: RecipeMakeability
  onClose: () => void
  onPushed: (recipe: RecipeMakeability, result: ShoppingListPushResult) => void
}

// Default name for a freshly created list: "<Recipe Name> - DD-MM-YY".
const defaultListName = (recipeName: string): string => {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `${recipeName} - ${dd}-${mm}-${yy}`
}

export default function ShoppingListPushModal({
  householdId,
  recipe,
  onClose,
  onPushed,
}: ShoppingListPushModalProps) {
  const [lists, setLists] = useState<ShoppingList[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pushing, setPushing] = useState(false)
  // 'new' creates a list; otherwise the selected list id.
  const [target, setTarget] = useState<string>('new')
  const [newName, setNewName] = useState(defaultListName(recipe.name))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const fetched = await listShoppingLists(householdId)
        if (cancelled) return
        setLists(fetched)
        // Prefer an existing list when there is one.
        if (fetched.length > 0) setTarget(fetched[0].id)
      } catch {
        if (!cancelled) setError('Failed to load shopping lists')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId])

  const handlePush = async () => {
    const creating = target === 'new'
    if (creating && !newName.trim()) return
    try {
      setPushing(true)
      setError('')
      const result = await pushToShoppingList(
        householdId,
        recipe.missing,
        creating ? { createListName: newName.trim() } : { listId: target }
      )
      onPushed(recipe, result)
    } catch {
      setError('Failed to update the Mealie shopping list')
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add missing to a shopping list
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Adding {recipe.missing.length} missing ingredient{recipe.missing.length === 1 ? '' : 's'} from{' '}
          <span className="font-medium text-gray-900 dark:text-white">{recipe.name}</span>.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading lists…</p>
        ) : (
          <div className="space-y-3">
            {lists && lists.length > 0 && (
              <div>
                <label htmlFor="target-list" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shopping list
                </label>
                <select
                  id="target-list"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                  <option value="new">+ Create a new list…</option>
                </select>
              </div>
            )}

            {target === 'new' && (
              <div>
                <label htmlFor="new-list-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New list name
                </label>
                <input
                  id="new-list-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={pushing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePush}
            disabled={loading || pushing || (target === 'new' && !newName.trim())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pushing ? 'Adding…' : 'Add to list'}
          </button>
        </div>
      </div>
    </div>
  )
}
