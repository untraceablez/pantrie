import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { listHouseholds, type HouseholdWithRole } from '@/services/household'
import {
  getMealieRecipes,
  type RecipeMakeability,
  type ShoppingListPushResult,
} from '@/services/mealie'
import ShoppingListPushModal from '@/components/recipes/ShoppingListPushModal'

export default function Recipes() {
  const navigate = useNavigate()
  const { resolvedTheme } = useThemeStore()

  const [households, setHouseholds] = useState<HouseholdWithRole[]>([])
  const [householdId, setHouseholdId] = useState<number | null>(null)
  const [recipes, setRecipes] = useState<RecipeMakeability[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // The recipe whose "add missing" modal is open, if any.
  const [pushTarget, setPushTarget] = useState<RecipeMakeability | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const hh = await listHouseholds()
        setHouseholds(hh)
        if (hh.length > 0) setHouseholdId(hh[0].id)
        else setLoading(false)
      } catch {
        setError('Failed to load households')
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (householdId === null) return
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const data = await getMealieRecipes(householdId)
        setRecipes(data.recipes)
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError(
            'No Mealie connection configured. Add one in Settings → Household Settings → Mealie Connection.'
          )
        } else {
          setError('Failed to load recipes from Mealie. Check the connection settings.')
        }
        setRecipes(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [householdId])

  const handlePushed = (recipe: RecipeMakeability, result: ShoppingListPushResult) => {
    setPushTarget(null)
    const updatedNote = result.updated > 0 ? ` (${result.updated} updated)` : ''
    setNotice(
      `${recipe.name}: added ${result.added}/${result.requested} to Mealie shopping list${updatedNote}`
    )
    setTimeout(() => setNotice(''), 4000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img
              src={resolvedTheme === 'dark' ? '/pantrie-logo-light.png' : '/pantrie-logo-dark.png'}
              alt="Pantrie"
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Recipes</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                What you can make from your inventory, via Mealie
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
          >
            Back to Inventory
          </button>
        </div>

        {households.length > 1 && (
          <div className="mb-6 bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Household
            </label>
            <select
              value={householdId ?? ''}
              onChange={(e) => setHouseholdId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {notice && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">{notice}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md">
            <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">Loading recipes…</p>
        ) : recipes && recipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
              <div
                key={recipe.recipe_id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {recipe.name}
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      recipe.makeable
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {recipe.makeable ? 'Can make' : `Missing ${recipe.missing.length}`}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {recipe.available_ingredients}/{recipe.total_ingredients} ingredients in stock
                </p>
                {recipe.missing.length > 0 && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      Missing: {recipe.missing.join(', ')}
                    </p>
                    <button
                      onClick={() => setPushTarget(recipe)}
                      className="mt-3 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add missing to Mealie list
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : recipes ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            No recipes found in your Mealie instance.
          </p>
        ) : null}
      </div>

      {householdId !== null && pushTarget && (
        <ShoppingListPushModal
          householdId={householdId}
          recipe={pushTarget}
          onClose={() => setPushTarget(null)}
          onPushed={handlePushed}
        />
      )}
    </div>
  )
}
